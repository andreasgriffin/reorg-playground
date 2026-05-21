export function currentConnectionHost() {
	if (typeof window === "undefined") {
		return "localhost";
	}

	return window.location.hostname || "localhost";
}

function formatHost(host: string) {
	if (host.includes(":") && !host.startsWith("[")) {
		return `[${host}]`;
	}

	return host;
}

export function formatSocketAddress(host: string, port: number) {
	return `${formatHost(host)}:${port}`;
}

export function buildHttpUrl(host: string, port: number, path = "") {
	return `http://${formatSocketAddress(host, port)}${path}`;
}

export function resolveMempoolWebUrl(
	network: Pick<
		import("./types").Network,
		"network_type" | "mempool_url" | "access_info"
	>,
) {
	if (network.network_type !== "Regtest") {
		return network.mempool_url ?? null;
	}

	const webPort = network.access_info?.mempool_space?.web_port;
	if (webPort != null) {
		return buildHttpUrl(currentConnectionHost(), webPort);
	}

	return network.mempool_url ?? null;
}

export function buildMempoolItemUrl(
	network: Pick<
		import("./types").Network,
		"network_type" | "mempool_url" | "access_info"
	>,
	itemType: "block" | "tx",
	hash: string,
) {
	const baseUrl = resolveMempoolWebUrl(network);
	if (!baseUrl || !hash) return null;
	return `${baseUrl}/${itemType}/${hash}`;
}
