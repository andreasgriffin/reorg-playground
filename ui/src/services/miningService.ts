import type { MineBlockResponse } from "../types";

type MineBlockOptions = {
	count?: number;
	excludeMempoolTransactions?: boolean;
};

export async function mineBlock(
	networkId: number,
	nodeId: number,
	options: MineBlockOptions = {},
): Promise<MineBlockResponse> {
	const { count, excludeMempoolTransactions } = options;
	const res = await fetch(`/api/${networkId}/mine-block`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			node_id: nodeId,
			...(count === undefined ? {} : { count }),
			...(excludeMempoolTransactions === undefined
				? {}
				: { exclude_mempool_txs: excludeMempoolTransactions }),
		}),
	});
	return res.json();
}
