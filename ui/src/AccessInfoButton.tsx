import { ExternalLinkIcon, ServerIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
	buildHttpUrl,
	currentConnectionHost,
	formatSocketAddress,
} from "./networkAccess";
import type { BitcoinNodeAccessInfo, Network } from "./types";

type AccessInfoButtonProps = {
	network: Network;
	buttonClassName?: string;
};

function ValueRow({
	label,
	value,
	href,
}: {
	label: string;
	value: string;
	href?: string;
}) {
	return (
		<div className="space-y-1">
			<p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
				{label}
			</p>
			{href ? (
				<a
					href={href}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-1.5 break-all font-mono text-[11px] text-primary underline-offset-4 hover:underline"
				>
					{value}
					<ExternalLinkIcon className="size-3" />
				</a>
			) : (
				<p className="break-all rounded-md bg-muted/70 px-2 py-1.5 font-mono text-[11px]">
					{value}
				</p>
			)}
		</div>
	);
}

function CommandRow({
	id,
	label,
	command,
	copied,
	onCopy,
}: {
	id: string;
	label: string;
	command: string;
	copied: boolean;
	onCopy: (fieldId: string, value: string) => void;
}) {
	return (
		<div className="space-y-1">
			<p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
				{label}
			</p>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
				<p className="break-all rounded-md bg-muted/70 px-2 py-1.5 font-mono text-[11px]">
					{command}
				</p>
				<Button
					type="button"
					variant="outline"
					size="xs"
					className="bg-background/70"
					onClick={() => onCopy(id, command)}
					aria-label={`Copy ${label}`}
				>
					{copied ? "Copied" : "Copy"}
				</Button>
			</div>
		</div>
	);
}

function BitcoinNodeCard({
	node,
	host,
	copiedCommand,
	onCopyCommand,
}: {
	node: BitcoinNodeAccessInfo;
	host: string;
	copiedCommand: string | null;
	onCopyCommand: (fieldId: string, value: string) => void;
}) {
	const rpcUrl =
		node.rpc_port != null ? buildHttpUrl(host, node.rpc_port) : undefined;
	const p2pAddress =
		node.p2p_port != null
			? formatSocketAddress(host, node.p2p_port)
			: undefined;
	const networkCheckCommand =
		node.rpc_port != null && node.rpc_user && node.rpc_password
			? `curl -fsS --user ${node.rpc_user}:${node.rpc_password} --data-binary '{"jsonrpc":"1.0","id":"net","method":"getpeerinfo","params":[]}' -H 'content-type:text/plain;' ${rpcUrl}/ | jq '.result | map({addr, inbound, connection_type, synced_headers, synced_blocks})'`
			: undefined;

	return (
		<Card className="gap-3 border-border/70 bg-card/70 py-4">
			<CardHeader className="gap-1 px-4 pb-0">
				<div className="flex items-center justify-between gap-3">
					<CardTitle className="text-sm">{node.name}</CardTitle>
					<Badge variant="secondary">bitcoind</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-2 px-4">
				{rpcUrl && <ValueRow label="RPC Endpoint" value={rpcUrl} />}
				{node.rpc_user && (
					<ValueRow label="RPC Username" value={node.rpc_user} />
				)}
				{node.rpc_password && (
					<ValueRow label="RPC Password" value={node.rpc_password} />
				)}
				{p2pAddress && <ValueRow label="P2P Endpoint" value={p2pAddress} />}
				{networkCheckCommand && (
					<CommandRow
						id={`bitcoind-check-${node.node_id}`}
						label="Linux Check Command"
						command={networkCheckCommand}
						copied={copiedCommand === `bitcoind-check-${node.node_id}`}
						onCopy={onCopyCommand}
					/>
				)}
			</CardContent>
		</Card>
	);
}

export function AccessInfoButton({
	network,
	buttonClassName,
}: AccessInfoButtonProps) {
	const [open, setOpen] = useState(false);
	const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
	const host = useMemo(currentConnectionHost, []);
	const accessInfo = network.access_info;

	if (!accessInfo) {
		return null;
	}

	const fulcrumTcpAddress = accessInfo.fulcrum
		? formatSocketAddress(host, accessInfo.fulcrum.tcp_port)
		: null;
	const fulcrumStatsUrl =
		accessInfo.fulcrum?.stats_port != null
			? buildHttpUrl(host, accessInfo.fulcrum.stats_port, "/stats")
			: null;
	const mempoolWebUrl =
		accessInfo.mempool_space != null
			? buildHttpUrl(host, accessInfo.mempool_space.web_port)
			: network.mempool_url;
	const mempoolApiUrl = mempoolWebUrl ? `${mempoolWebUrl}/api` : null;
	const fulcrumCheckCommand = fulcrumTcpAddress
		? `printf '{"id":1,"method":"blockchain.headers.subscribe","params":[]}\n' | nc -w 2 ${host} ${accessInfo.fulcrum?.tcp_port} | jq .`
		: null;
	const mempoolCheckCommand = mempoolApiUrl
		? `curl -fsS ${mempoolApiUrl}/mempool/recent | jq '.[0:10] | map({txid, fee, value, vsize})'`
		: null;

	const copyCommand = async (fieldId: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setCopiedCommand(fieldId);
			window.setTimeout(() => {
				setCopiedCommand((currentField) =>
					currentField === fieldId ? null : currentField,
				);
			}, 1200);
		} catch {
			setCopiedCommand(null);
		}
	};

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="xs"
				className={buttonClassName}
				onClick={() => setOpen(true)}
			>
				<ServerIcon className="size-3.5" />
				Access Info
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-4xl">
					<DialogHeader>
						<DialogTitle>Connect to Regtest Services</DialogTitle>
						<DialogDescription>
							These endpoints use the current app host{" "}
							<span className="font-mono text-foreground">{host}</span>. For a
							different machine on your LAN, use this host&apos;s IP or hostname
							in the same port combinations.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-3">
								<h3 className="text-sm font-semibold">Bitcoin Core Nodes</h3>
								<Badge variant="outline">
									{accessInfo.bitcoin_nodes.length} endpoint
									{accessInfo.bitcoin_nodes.length === 1 ? "" : "s"}
								</Badge>
							</div>
							<div className="grid gap-2 lg:grid-cols-2">
								{accessInfo.bitcoin_nodes.map((node) => (
									<BitcoinNodeCard
										key={node.node_id}
										node={node}
										host={host}
										copiedCommand={copiedCommand}
										onCopyCommand={copyCommand}
									/>
								))}
							</div>
						</div>

						<Separator />

						<div className="grid gap-2 lg:grid-cols-2">
							{accessInfo.fulcrum && (
								<Card className="gap-3 border-border/70 bg-card/70 py-4">
									<CardHeader className="px-4 pb-0">
										<CardTitle className="text-sm">Fulcrum</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2 px-4">
										{fulcrumTcpAddress && (
											<ValueRow
												label="Electrum TCP"
												value={fulcrumTcpAddress}
											/>
										)}
										{fulcrumStatsUrl && (
											<ValueRow
												label="Stats"
												value={fulcrumStatsUrl}
												href={fulcrumStatsUrl}
											/>
										)}
										{fulcrumCheckCommand && (
											<CommandRow
												id="fulcrum-check"
												label="Linux Check Command"
												command={fulcrumCheckCommand}
												copied={copiedCommand === "fulcrum-check"}
												onCopy={copyCommand}
											/>
										)}
									</CardContent>
								</Card>
							)}

							{(mempoolWebUrl || mempoolApiUrl) && (
								<Card className="gap-3 border-border/70 bg-card/70 py-4">
									<CardHeader className="px-4 pb-0">
										<CardTitle className="text-sm">mempool.space</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2 px-4">
										{mempoolWebUrl && (
											<ValueRow
												label="Web UI"
												value={mempoolWebUrl}
												href={mempoolWebUrl}
											/>
										)}
										{mempoolApiUrl && (
											<ValueRow
												label="REST API Root"
												value={mempoolApiUrl}
												href={mempoolApiUrl}
											/>
										)}
										{mempoolCheckCommand && (
											<CommandRow
												id="mempool-check"
												label="Linux Check Command"
												command={mempoolCheckCommand}
												copied={copiedCommand === "mempool-check"}
												onCopy={copyCommand}
											/>
										)}
									</CardContent>
								</Card>
							)}
						</div>
					</div>

					<DialogFooter showCloseButton />
				</DialogContent>
			</Dialog>
		</>
	);
}
