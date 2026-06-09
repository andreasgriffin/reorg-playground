import { useCallback, useState } from 'react'
import { mutate } from 'swr'
import { sendFaucetTransaction } from '../services/faucetService'
import { mineBlock } from '../services/miningService'
import { getNetworkSnapshotKey } from '../services/swrKeys'
import type { Network } from '../types'
import { useNotification } from './useNotification'

type FaucetDelayRange = {
  min: number
  max: number
}

type SendFaucetSequenceOptions = {
  randomDelayRangeSeconds?: FaucetDelayRange | null
  mineBlocksBetweenTransactions?: number
}

export type FaucetSequenceRequest = {
  address: string
  amountBtc: string
  nodeId: number
  nodeName: string
}

export type FaucetSequenceProgress = {
  completedCount: number
  totalCount: number
  message: string
}

export type FaucetSequenceResult = {
  transactions: Array<{
    address: string
    amountBtc: string
    nodeName: string
    txid?: string
    refillMinedBlocks: number
  }>
  totalRefillMinedBlocks: number
  totalInterTransactionMinedBlocks: number
}

function formatTransactionLabel(index: number, total: number) {
  return total === 1 ? 'transaction' : `transaction ${index + 1} of ${total}`
}

function randomIntInclusive(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export function useFaucet(network: Network) {
  const { notifyError, notifySuccess } = useNotification()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<FaucetSequenceProgress | null>(null)

  const sendSequence = useCallback(
    async (
      requests: FaucetSequenceRequest[],
      options: SendFaucetSequenceOptions = {},
    ): Promise<FaucetSequenceResult> => {
      const totalCount = requests.length
      const transactions: FaucetSequenceResult['transactions'] = []
      let totalRefillMinedBlocks = 0
      let totalInterTransactionMinedBlocks = 0
      const mineBlocksBetweenTransactions = options.mineBlocksBetweenTransactions ?? 0
      const shouldDelay = options.randomDelayRangeSeconds != null && totalCount > 1

      setLoading(true)
      setProgress({
        completedCount: 0,
        totalCount,
        message: `Preparing ${totalCount} faucet transaction${totalCount === 1 ? '' : 's'}.`,
      })

      try {
        for (const [index, request] of requests.entries()) {
          setProgress({
            completedCount: index,
            totalCount,
            message: `Sending ${formatTransactionLabel(index, totalCount)} with ${request.amountBtc} BTC to ${request.address} via ${request.nodeName}.`,
          })

          const result = await sendFaucetTransaction(network.id, {
            node_id: request.nodeId,
            address: request.address,
            amount_btc: request.amountBtc,
          })

          if (!result.success) {
            throw new Error(result.error ?? 'Unknown error')
          }

          const refillMinedBlocks = result.mined_blocks ?? 0
          totalRefillMinedBlocks += refillMinedBlocks
          transactions.push({
            address: request.address,
            amountBtc: request.amountBtc,
            nodeName: request.nodeName,
            txid: result.txid,
            refillMinedBlocks,
          })

          const hasNextRequest = index < totalCount - 1
          if (!hasNextRequest) {
            continue
          }

          if (shouldDelay && options.randomDelayRangeSeconds) {
            const delaySeconds = randomIntInclusive(
              options.randomDelayRangeSeconds.min,
              options.randomDelayRangeSeconds.max,
            )
            if (delaySeconds > 0) {
              setProgress({
                completedCount: index + 1,
                totalCount,
                message: `Waiting ${delaySeconds} second${delaySeconds === 1 ? '' : 's'} before the next faucet transaction.`,
              })
              await sleep(delaySeconds * 1000)
            }
          }

          if (mineBlocksBetweenTransactions > 0) {
            setProgress({
              completedCount: index + 1,
              totalCount,
              message: `Mining ${mineBlocksBetweenTransactions} block${mineBlocksBetweenTransactions === 1 ? '' : 's'} on ${request.nodeName} before the next faucet transaction.`,
            })
            const mineResult = await mineBlock(network.id, request.nodeId, {
              count: mineBlocksBetweenTransactions,
            })
            if (!mineResult.success) {
              throw new Error(mineResult.error ?? 'Unknown error')
            }
            totalInterTransactionMinedBlocks += mineBlocksBetweenTransactions
          }
        }

        const uniqueNodeNames = [...new Set(requests.map(request => request.nodeName))]
        const nodeSummary = uniqueNodeNames.length === 1 ? uniqueNodeNames[0] : `${uniqueNodeNames.length} nodes`

        notifySuccess({
          title: totalCount === 1 ? 'Faucet transaction broadcast' : 'Faucet batch broadcast',
          description: `Broadcast ${totalCount} unconfirmed transaction${totalCount === 1 ? '' : 's'} from ${nodeSummary}. Refill mining: ${totalRefillMinedBlocks} block${totalRefillMinedBlocks === 1 ? '' : 's'}. Between sends: ${totalInterTransactionMinedBlocks} mined block${totalInterTransactionMinedBlocks === 1 ? '' : 's'}.`,
        })

        return {
          transactions,
          totalRefillMinedBlocks,
          totalInterTransactionMinedBlocks,
        }
      } catch (err) {
        const completedCount = transactions.length
        const partialSummary =
          completedCount > 0
            ? ` Completed ${completedCount} of ${totalCount} faucet transaction${totalCount === 1 ? '' : 's'} before the workflow stopped.`
            : ''
        notifyError({
          title: 'Could not complete faucet workflow',
          description: `${err instanceof Error ? err.message : 'Network error'}${partialSummary}`,
        })
        throw err
      } finally {
        setLoading(false)
        setProgress(null)
        void mutate(getNetworkSnapshotKey(network.id))
      }
    },
    [network.id, notifyError, notifySuccess],
  )

  return { sendSequence, loading, progress }
}
