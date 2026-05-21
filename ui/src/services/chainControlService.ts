import type { RewindChainResponse, RpcActionResponse } from "../types";

export async function rewindChain(
	networkId: number,
	nodeId: number,
	depth: number,
): Promise<RewindChainResponse> {
	const res = await fetch(`/api/${networkId}/rewind-chain`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			node_id: nodeId,
			depth,
		}),
	});
	return res.json();
}

export async function reconsiderBlock(
	networkId: number,
	nodeId: number,
	blockHash: string,
): Promise<RpcActionResponse> {
	const res = await fetch(`/api/${networkId}/reconsider-block`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			node_id: nodeId,
			block_hash: blockHash,
		}),
	});
	return res.json();
}
