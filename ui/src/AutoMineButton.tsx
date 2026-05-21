import { Clock3, PauseCircle, Pickaxe } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useNotification } from "@/hooks/useNotification";
import { mineBlock } from "@/services/miningService";
import { getNetworkSnapshotKey } from "@/services/swrKeys";
import { cn, isRegtestOrSignet } from "@/utils";
import type { Network, NodeInfo } from "./types";

type AutoMineButtonProps = {
	network: Network;
	nodes: NodeInfo[];
	buttonClassName?: string;
};

type ActiveAutoMineConfig = {
	intervalSeconds: number;
	nodeIds: number[];
};

const DEFAULT_INTERVAL_SECONDS = 10;
const MIN_INTERVAL_SECONDS = 1;
const MAX_INTERVAL_SECONDS = 3600;

function formatSelectedNodes(selectedNodes: NodeInfo[]) {
	if (selectedNodes.length === 0) return "No nodes selected";
	if (selectedNodes.length === 1) return `Mine on ${selectedNodes[0].name}`;
	return `Randomly choose between ${selectedNodes
		.map((node) => node.name)
		.join(", ")}`;
}

function formatRelativeNextMine(nextMineAt: number | null) {
	if (nextMineAt == null) return "Scheduling...";
	const secondsRemaining = Math.max(
		0,
		Math.ceil((nextMineAt - Date.now()) / 1000),
	);
	return `Next block in ${secondsRemaining}s`;
}

export function AutoMineButton({
	network,
	nodes,
	buttonClassName,
}: AutoMineButtonProps) {
	const { notifyError, notifySuccess } = useNotification();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [intervalSecondsInput, setIntervalSecondsInput] = useState(
		String(DEFAULT_INTERVAL_SECONDS),
	);
	const eligibleNodes = useMemo(
		() => nodes.filter((node) => node.supports_mining),
		[nodes],
	);
	const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
	const [activeConfig, setActiveConfig] = useState<ActiveAutoMineConfig | null>(
		null,
	);
	const [lastMinedNodeName, setLastMinedNodeName] = useState<string | null>(
		null,
	);
	const [lastMinedAt, setLastMinedAt] = useState<number | null>(null);
	const [nextMineAt, setNextMineAt] = useState<number | null>(null);
	const [, setStatusTick] = useState(0);
	const [isMiningTick, setIsMiningTick] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

	useEffect(() => {
		const eligibleIdSet = new Set(eligibleNodes.map((node) => node.id));
		setSelectedNodeIds((current) => {
			const retained = current.filter((nodeId) => eligibleIdSet.has(nodeId));
			if (retained.length > 0) return retained;
			return eligibleNodes.map((node) => node.id);
		});
	}, [eligibleNodes]);

	useEffect(() => {
		if (activeConfig == null || nextMineAt == null) return;
		const intervalId = window.setInterval(() => {
			setStatusTick((tick) => tick + 1);
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, [activeConfig, nextMineAt]);

	const stopAutoMine = useEffectEvent((reason?: string) => {
		if (timeoutRef.current != null) {
			window.clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setActiveConfig(null);
		setNextMineAt(null);
		setIsMiningTick(false);
		if (reason) {
			notifyError({
				title: "Auto-mine stopped",
				description: reason,
			});
		}
	});

	const mineNextBlock = useEffectEvent(async () => {
		const config = activeConfig;
		if (config == null) return false;

		const selectedEligibleNodes = eligibleNodes.filter((node) =>
			config.nodeIds.includes(node.id),
		);
		if (selectedEligibleNodes.length === 0) {
			stopAutoMine("None of the selected mining nodes are available anymore.");
			return false;
		}

		const selectedNode =
			selectedEligibleNodes[
				Math.floor(Math.random() * selectedEligibleNodes.length)
			];

		setIsMiningTick(true);
		try {
			const result = await mineBlock(network.id, selectedNode.id);
			if (!result.success) {
				throw new Error(result.error ?? "Unknown error");
			}
			void mutate(getNetworkSnapshotKey(network.id));
			setLastMinedNodeName(selectedNode.name);
			setLastMinedAt(Date.now());
			return true;
		} catch (error) {
			stopAutoMine(
				`Could not mine on ${selectedNode.name}: ${
					error instanceof Error ? error.message : "Network error"
				}`,
			);
			return false;
		} finally {
			setIsMiningTick(false);
		}
	});

	useEffect(() => {
		if (activeConfig == null) return;

		let cancelled = false;

		const scheduleNextTick = () => {
			const nextTickTime = Date.now() + activeConfig.intervalSeconds * 1000;
			setNextMineAt(nextTickTime);
			timeoutRef.current = window.setTimeout(async () => {
				const shouldContinue = await mineNextBlock();
				if (!cancelled && shouldContinue) {
					scheduleNextTick();
				}
			}, activeConfig.intervalSeconds * 1000);
		};

		scheduleNextTick();

		return () => {
			cancelled = true;
			if (timeoutRef.current != null) {
				window.clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, [activeConfig]);

	if (
		network.view_only_mode ||
		!isRegtestOrSignet(network) ||
		eligibleNodes.length === 0
	) {
		return null;
	}

	const selectedNodes = eligibleNodes.filter((node) =>
		selectedNodeIds.includes(node.id),
	);
	const canStart =
		activeConfig == null &&
		selectedNodes.length > 0 &&
		Number.isFinite(Number(intervalSecondsInput)) &&
		Number(intervalSecondsInput) >= MIN_INTERVAL_SECONDS;
	const activeSelectedNodes =
		activeConfig == null
			? selectedNodes
			: eligibleNodes.filter((node) => activeConfig.nodeIds.includes(node.id));

	const handleToggleNode = (nodeId: number, checked: boolean) => {
		setSelectedNodeIds((current) => {
			if (checked) {
				return [...current, nodeId].sort((a, b) => a - b);
			}
			return current.filter((id) => id !== nodeId);
		});
	};

	const handleStart = () => {
		if (!canStart) return;
		const sanitizedInterval = Math.max(
			MIN_INTERVAL_SECONDS,
			Math.min(
				MAX_INTERVAL_SECONDS,
				Math.floor(Number(intervalSecondsInput) || 0),
			),
		);
		setIntervalSecondsInput(String(sanitizedInterval));
		setActiveConfig({
			intervalSeconds: sanitizedInterval,
			nodeIds: selectedNodes.map((node) => node.id),
		});
		setLastMinedNodeName(null);
		setLastMinedAt(null);
		notifySuccess({
			title: "Auto-mine enabled",
			description: `${formatSelectedNodes(selectedNodes)} every ${sanitizedInterval}s.`,
		});
		setDialogOpen(false);
	};

	const handleStop = () => {
		if (activeConfig == null) return;
		stopAutoMine();
		notifySuccess({
			title: "Auto-mine disabled",
			description: "Stopped the background mining loop.",
		});
	};

	return (
		<>
			<Button
				type="button"
				variant={activeConfig ? "default" : "outline"}
				size="xs"
				className={cn("gap-1.5", buttonClassName)}
				onClick={() => setDialogOpen(true)}
			>
				{activeConfig ? (
					<Clock3 className="size-3.5" />
				) : (
					<Pickaxe className="size-3.5" />
				)}
				{activeConfig ? "Auto Mine On" : "Auto Mine"}
			</Button>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Auto Mine</DialogTitle>
						<DialogDescription>
							Mine blocks on a timer. Select one node to mine deterministically,
							or select multiple nodes and one will be chosen at random each
							round.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="rounded-md border border-border/70 bg-muted/30 p-3">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium">
										{activeConfig ? "Running" : "Idle"}
									</p>
									<p className="text-xs text-muted-foreground">
										{activeConfig
											? `${formatSelectedNodes(activeSelectedNodes)} every ${activeConfig.intervalSeconds}s.`
											: "Not currently mining on a timer."}
									</p>
								</div>
								<Badge variant={activeConfig ? "default" : "outline"}>
									{activeConfig ? "Active" : "Stopped"}
								</Badge>
							</div>
							{activeConfig && (
								<div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									<span>{formatRelativeNextMine(nextMineAt)}</span>
									{isMiningTick && (
										<span className="inline-flex items-center gap-1.5">
											<Spinner className="size-3" />
											Mining now
										</span>
									)}
									{lastMinedNodeName && lastMinedAt && (
										<span>
											Last block: {lastMinedNodeName} at{" "}
											{new Date(lastMinedAt).toLocaleTimeString()}
										</span>
									)}
								</div>
							)}
						</div>

						<div className="space-y-1.5">
							<label className="text-sm" htmlFor="auto-mine-interval">
								Interval (seconds)
							</label>
							<Input
								id="auto-mine-interval"
								type="number"
								min={MIN_INTERVAL_SECONDS}
								max={MAX_INTERVAL_SECONDS}
								value={intervalSecondsInput}
								onChange={(event) =>
									setIntervalSecondsInput(event.target.value)
								}
								disabled={activeConfig != null}
							/>
						</div>

						<div className="space-y-2">
							<div className="text-sm">Mining Nodes</div>
							<div className="space-y-2">
								{eligibleNodes.map((node) => {
									const checked = selectedNodeIds.includes(node.id);
									return (
										<label
											key={node.id}
											className="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
										>
											<input
												type="checkbox"
												checked={checked}
												onChange={(event) =>
													handleToggleNode(node.id, event.target.checked)
												}
												disabled={activeConfig != null}
												className="mt-0.5 size-4"
											/>
											<div className="space-y-1">
												<div className="text-sm">{node.name}</div>
												<p className="text-xs text-muted-foreground">
													{node.description}
												</p>
											</div>
										</label>
									);
								})}
							</div>
							<p className="text-xs text-muted-foreground">
								{selectedNodes.length <= 1
									? formatSelectedNodes(selectedNodes)
									: `${formatSelectedNodes(selectedNodes)} at each interval.`}
							</p>
						</div>
					</div>

					<DialogFooter>
						{activeConfig ? (
							<>
								<Button variant="outline" onClick={() => setDialogOpen(false)}>
									Close
								</Button>
								<Button variant="destructive" onClick={handleStop}>
									<PauseCircle className="size-3.5" />
									Stop Auto Mine
								</Button>
							</>
						) : (
							<>
								<Button variant="outline" onClick={() => setDialogOpen(false)}>
									Cancel
								</Button>
								<Button onClick={handleStart} disabled={!canStart}>
									Start Auto Mine
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
