import { Droplets } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { type FaucetSequenceRequest, type FaucetSequenceResult, useFaucet } from '@/hooks/useFaucet'
import { cn } from '@/utils'
import { MempoolHashLink } from './MempoolHashLink'
import type { Network, NodeInfo } from './types'

type FaucetButtonProps = {
  network: Network
  nodes: NodeInfo[]
  buttonClassName?: string
}

const SATS_PER_BTC = 100_000_000
const DEFAULT_FAUCET_AMOUNT_BTC = '0.1'
const DEFAULT_RANDOM_AMOUNT_MIN_BTC = '0.01'
const DEFAULT_RANDOM_AMOUNT_MAX_BTC = '0.1'
const DEFAULT_DELAY_MIN_SECONDS = '3'
const DEFAULT_DELAY_MAX_SECONDS = '20'
const DEFAULT_BLOCKS_BETWEEN_TRANSACTIONS = '0'

function parseAddressList(value: string) {
  return value
    .split(/[\s,;]+/)
    .map(entry => entry.trim())
    .filter(Boolean)
}

function parseNonNegativeInteger(value: string) {
  if (value.trim().length === 0) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

function parseBtcToSats(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/^(\d+)(?:\.(\d{0,8}))?$|^\.(\d{1,8})$/)
  if (!match) {
    return null
  }

  const wholePart = match[1] ?? '0'
  const fractionalPart = match[2] ?? match[3] ?? ''
  const wholeSats = Number(wholePart) * SATS_PER_BTC
  const fractionalSats = Number(`${fractionalPart}${'0'.repeat(8)}`.slice(0, 8))
  const totalSats = wholeSats + fractionalSats

  if (!Number.isSafeInteger(totalSats) || totalSats <= 0) {
    return null
  }

  return totalSats
}

function formatSatsAsBtc(sats: number) {
  const wholePart = Math.floor(sats / SATS_PER_BTC)
  const fractionalPart = String(sats % SATS_PER_BTC)
    .padStart(8, '0')
    .replace(/0+$/, '')
  return fractionalPart ? `${wholePart}.${fractionalPart}` : `${wholePart}`
}

function randomIntInclusive(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function defaultNodeId(nodes: NodeInfo[]) {
  return nodes.length > 0 ? String(nodes[0].id) : ''
}

export function FaucetButton({ network, nodes, buttonClassName }: FaucetButtonProps) {
  const eligibleNodes = useMemo(() => nodes.filter(node => node.supports_controls && node.supports_mining), [nodes])
  const { sendSequence, loading, progress } = useFaucet(network)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nodeId, setNodeId] = useState('')
  const [addressesInput, setAddressesInput] = useState('')
  const [amountBtc, setAmountBtc] = useState(DEFAULT_FAUCET_AMOUNT_BTC)
  const [useRandomAmountRange, setUseRandomAmountRange] = useState(true)
  const [useRandomNode, setUseRandomNode] = useState(true)
  const [randomAmountMinBtc, setRandomAmountMinBtc] = useState(DEFAULT_RANDOM_AMOUNT_MIN_BTC)
  const [randomAmountMaxBtc, setRandomAmountMaxBtc] = useState(DEFAULT_RANDOM_AMOUNT_MAX_BTC)
  const [enableRandomDelay, setEnableRandomDelay] = useState(true)
  const [delayMinSecondsInput, setDelayMinSecondsInput] = useState(DEFAULT_DELAY_MIN_SECONDS)
  const [delayMaxSecondsInput, setDelayMaxSecondsInput] = useState(DEFAULT_DELAY_MAX_SECONDS)
  const [blocksBetweenTransactionsInput, setBlocksBetweenTransactionsInput] = useState(
    DEFAULT_BLOCKS_BETWEEN_TRANSACTIONS,
  )
  const [result, setResult] = useState<FaucetSequenceResult | null>(null)
  const addresses = parseAddressList(addressesInput)

  if (network.view_only_mode || network.network_type !== 'Regtest' || eligibleNodes.length === 0) {
    return null
  }

  const selectedNode = eligibleNodes.find(node => String(node.id) === nodeId) ?? null
  const fixedAmountSats = parseBtcToSats(amountBtc)
  const randomAmountMinSats = parseBtcToSats(randomAmountMinBtc)
  const randomAmountMaxSats = parseBtcToSats(randomAmountMaxBtc)
  const delayMinSeconds = parseNonNegativeInteger(delayMinSecondsInput)
  const delayMaxSeconds = parseNonNegativeInteger(delayMaxSecondsInput)
  const blocksBetweenTransactions = parseNonNegativeInteger(blocksBetweenTransactionsInput)
  const amountRangeIsValid =
    !useRandomAmountRange ||
    (randomAmountMinSats !== null && randomAmountMaxSats !== null && randomAmountMinSats <= randomAmountMaxSats)
  const fixedAmountIsValid = useRandomAmountRange || fixedAmountSats !== null
  const delayRangeIsValid =
    !enableRandomDelay || (delayMinSeconds !== null && delayMaxSeconds !== null && delayMinSeconds <= delayMaxSeconds)
  const canSubmit =
    (useRandomNode || selectedNode !== null) &&
    addresses.length > 0 &&
    fixedAmountIsValid &&
    amountRangeIsValid &&
    blocksBetweenTransactions !== null &&
    delayRangeIsValid &&
    !loading

  const openDialog = () => {
    if (!nodeId) setNodeId(defaultNodeId(eligibleNodes))
    setDialogOpen(true)
  }

  const resetDialogState = () => {
    setNodeId(defaultNodeId(eligibleNodes))
    setAddressesInput('')
    setAmountBtc(DEFAULT_FAUCET_AMOUNT_BTC)
    setUseRandomAmountRange(true)
    setUseRandomNode(true)
    setRandomAmountMinBtc(DEFAULT_RANDOM_AMOUNT_MIN_BTC)
    setRandomAmountMaxBtc(DEFAULT_RANDOM_AMOUNT_MAX_BTC)
    setEnableRandomDelay(true)
    setDelayMinSecondsInput(DEFAULT_DELAY_MIN_SECONDS)
    setDelayMaxSecondsInput(DEFAULT_DELAY_MAX_SECONDS)
    setBlocksBetweenTransactionsInput(DEFAULT_BLOCKS_BETWEEN_TRANSACTIONS)
    setResult(null)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !loading) {
      resetDialogState()
    }
    setDialogOpen(open)
  }

  const buildRequests = (): FaucetSequenceRequest[] | null => {
    if (addresses.length === 0) {
      return null
    }

    const pickNode = () => {
      if (useRandomNode) {
        return randomItem(eligibleNodes)
      }

      return selectedNode
    }

    const buildRequest = (address: string, amountBtcValue: string): FaucetSequenceRequest => {
      const node = pickNode() ?? eligibleNodes[0]
      return {
        address,
        amountBtc: amountBtcValue,
        nodeId: node.id,
        nodeName: node.name,
      }
    }

    if (useRandomAmountRange) {
      if (randomAmountMinSats === null || randomAmountMaxSats === null || randomAmountMinSats > randomAmountMaxSats) {
        return null
      }

      return addresses.map(address =>
        buildRequest(address, formatSatsAsBtc(randomIntInclusive(randomAmountMinSats, randomAmountMaxSats))),
      )
    }

    if (fixedAmountSats === null) {
      return null
    }

    return addresses.map(address => buildRequest(address, amountBtc.trim()))
  }

  const handleSubmit = async () => {
    if (
      (!useRandomNode && !selectedNode) ||
      blocksBetweenTransactions === null ||
      (enableRandomDelay && (delayMinSeconds === null || delayMaxSeconds === null || delayMinSeconds > delayMaxSeconds))
    ) {
      return
    }

    const requests = buildRequests()
    if (!requests) {
      return
    }

    try {
      setResult(null)
      const faucetResult = await sendSequence(requests, {
        randomDelayRangeSeconds:
          enableRandomDelay && requests.length > 1
            ? {
                min: delayMinSeconds ?? 0,
                max: delayMaxSeconds ?? 0,
              }
            : null,
        mineBlocksBetweenTransactions: blocksBetweenTransactions,
      })
      setResult(faucetResult)
    } catch {
      setResult(null)
    }
  }

  return (
    <>
      <Button variant="outline" size="xs" className={cn('gap-1.5', buttonClassName)} onClick={openDialog}>
        <Droplets className="size-3.5" />
        Faucet
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-3xl"
          showCloseButton={!loading}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          onPointerDownOutside={loading ? e => e.preventDefault() : undefined}
          onEscapeKeyDown={loading ? e => e.preventDefault() : undefined}
        >
          <DialogHeader>
            <DialogTitle>Regtest Faucet</DialogTitle>
            <DialogDescription>
              Send one faucet transaction per destination address. Between addresses, you can wait a random number of
              seconds and optionally mine confirmation blocks before the next send.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm" htmlFor="faucet-addresses">
                    Destination Addresses
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {addresses.length} address{addresses.length === 1 ? '' : 'es'}
                  </span>
                </div>
                <Textarea
                  id="faucet-addresses"
                  value={addressesInput}
                  onChange={e => setAddressesInput(e.target.value)}
                  placeholder={'bcrt1...\nbcrt1...\nbcrt1...'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={loading || result !== null}
                  className="min-h-56"
                />
                <p className="text-xs text-muted-foreground">
                  Enter one address per line, or separate addresses with spaces or commas.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useRandomNode}
                        onChange={e => setUseRandomNode(e.target.checked)}
                        disabled={loading || result !== null || eligibleNodes.length === 1}
                        className="mt-0.5 size-4"
                      />
                      <div className="space-y-1">
                        <div className="text-sm">Random node per transaction</div>
                        <p className="text-xs text-muted-foreground">Picks a faucet source node for each send.</p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <label className="text-sm" htmlFor="faucet-node">
                        Source Node
                      </label>
                      <Select
                        value={nodeId}
                        onValueChange={setNodeId}
                        disabled={loading || result !== null || useRandomNode}
                      >
                        <SelectTrigger className="w-full" id="faucet-node">
                          <SelectValue placeholder="Select a node" />
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleNodes.map(node => (
                            <SelectItem key={node.id} value={String(node.id)}>
                              {node.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useRandomAmountRange}
                        onChange={e => setUseRandomAmountRange(e.target.checked)}
                        disabled={loading || result !== null}
                        className="mt-0.5 size-4"
                      />
                      <div className="space-y-1">
                        <div className="text-sm">Random amount per transaction</div>
                        <p className="text-xs text-muted-foreground">
                          Picks a fresh amount for each address from the range below.
                        </p>
                      </div>
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm" htmlFor="faucet-random-amount-min">
                          Minimum (BTC)
                        </label>
                        <Input
                          id="faucet-random-amount-min"
                          value={randomAmountMinBtc}
                          onChange={e => setRandomAmountMinBtc(e.target.value)}
                          inputMode="decimal"
                          disabled={loading || result !== null || !useRandomAmountRange}
                          aria-invalid={!amountRangeIsValid}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm" htmlFor="faucet-random-amount-max">
                          Maximum (BTC)
                        </label>
                        <Input
                          id="faucet-random-amount-max"
                          value={randomAmountMaxBtc}
                          onChange={e => setRandomAmountMaxBtc(e.target.value)}
                          inputMode="decimal"
                          disabled={loading || result !== null || !useRandomAmountRange}
                          aria-invalid={!amountRangeIsValid}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm" htmlFor="faucet-amount">
                        Fixed Amount (BTC)
                      </label>
                      <Input
                        id="faucet-amount"
                        value={amountBtc}
                        onChange={e => setAmountBtc(e.target.value)}
                        placeholder={DEFAULT_FAUCET_AMOUNT_BTC}
                        inputMode="decimal"
                        disabled={loading || result !== null || useRandomAmountRange}
                        aria-invalid={!fixedAmountIsValid}
                      />
                    </div>

                    {useRandomAmountRange && !amountRangeIsValid && (
                      <p className="text-xs text-destructive">
                        Enter a valid BTC amount range where the minimum is less than or equal to the maximum.
                      </p>
                    )}
                    {!useRandomAmountRange && !fixedAmountIsValid && (
                      <p className="text-xs text-destructive">Enter a valid BTC amount greater than zero.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_132px] sm:items-end">
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableRandomDelay}
                            onChange={e => setEnableRandomDelay(e.target.checked)}
                            disabled={loading || result !== null}
                            className="mt-0.5 size-4"
                          />
                          <div className="space-y-1">
                            <div className="text-sm">Random delay between transactions</div>
                            <p className="text-xs text-muted-foreground">
                              Applies only when sending to more than one address.
                            </p>
                          </div>
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm" htmlFor="faucet-delay-min">
                              Min Delay (s)
                            </label>
                            <Input
                              id="faucet-delay-min"
                              type="number"
                              min={0}
                              value={delayMinSecondsInput}
                              onChange={e => setDelayMinSecondsInput(e.target.value)}
                              disabled={loading || result !== null || !enableRandomDelay}
                              aria-invalid={!delayRangeIsValid}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm" htmlFor="faucet-delay-max">
                              Max Delay (s)
                            </label>
                            <Input
                              id="faucet-delay-max"
                              type="number"
                              min={0}
                              value={delayMaxSecondsInput}
                              onChange={e => setDelayMaxSecondsInput(e.target.value)}
                              disabled={loading || result !== null || !enableRandomDelay}
                              aria-invalid={!delayRangeIsValid}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm" htmlFor="faucet-blocks-between">
                          Mine Between Tx
                        </label>
                        <Input
                          id="faucet-blocks-between"
                          type="number"
                          min={0}
                          value={blocksBetweenTransactionsInput}
                          onChange={e => setBlocksBetweenTransactionsInput(e.target.value)}
                          disabled={loading || result !== null}
                          aria-invalid={blocksBetweenTransactions === null}
                        />
                      </div>
                    </div>

                    {enableRandomDelay && !delayRangeIsValid && (
                      <p className="text-xs text-destructive">
                        Enter a valid delay range where the minimum is less than or equal to the maximum.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Set mining to 0 to keep transactions unconfirmed unless the faucet wallet needs refill mining.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {loading && progress && (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <p>{progress.message}</p>
                <p className="text-xs text-muted-foreground">
                  Completed {progress.completedCount} of {progress.totalCount} faucet transaction
                  {progress.totalCount === 1 ? '' : 's'}.
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">
                <p>
                  Broadcast {result.transactions.length} unconfirmed transaction
                  {result.transactions.length === 1 ? '' : 's'} successfully.
                </p>
                <p>
                  {result.totalRefillMinedBlocks > 0
                    ? `The faucet mined ${result.totalRefillMinedBlocks} refill block${result.totalRefillMinedBlocks === 1 ? '' : 's'} during the run.`
                    : 'No refill mining was needed.'}
                </p>
                <p>
                  {result.totalInterTransactionMinedBlocks > 0
                    ? `Mined ${result.totalInterTransactionMinedBlocks} block${result.totalInterTransactionMinedBlocks === 1 ? '' : 's'} between transactions.`
                    : 'No blocks were mined between transactions.'}
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {result.transactions.map((transaction, index) => (
                    <div
                      key={`${transaction.address}-${transaction.txid ?? index}`}
                      className="rounded-md border border-success/30 bg-background/60 p-2 text-xs text-foreground"
                    >
                      <p className="break-all font-medium">
                        {index + 1}. {transaction.address}
                      </p>
                      <p>
                        Amount: {transaction.amountBtc} BTC via {transaction.nodeName}
                      </p>
                      {transaction.txid && (
                        <p className="break-all font-mono text-current/90">
                          Txid:{' '}
                          <MempoolHashLink
                            network={network}
                            hash={transaction.txid}
                            itemType="tx"
                            className="inline-flex items-center gap-1.5 break-all text-current underline-offset-4 hover:underline"
                            title={transaction.txid}
                          />
                        </p>
                      )}
                      {transaction.refillMinedBlocks > 0 && (
                        <p className="text-current/80">
                          Refill mining: {transaction.refillMinedBlocks} block
                          {transaction.refillMinedBlocks === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {result ? (
              <>
                <Button variant="outline" onClick={resetDialogState}>
                  Send Another
                </Button>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
              </>
            ) : (
              <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
                {loading ? <Spinner className="size-3" /> : null}
                {addresses.length > 1 ? 'Send Transactions' : 'Send Transaction'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
