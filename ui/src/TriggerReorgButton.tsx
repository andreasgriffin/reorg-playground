import { CheckIcon, CircleIcon, Shuffle, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
	type ReorgState,
	useTriggerReorg,
	type WorkflowStep,
} from "@/hooks/useTriggerReorg";
import { cn, isRegtestOrSignet } from "@/utils";
import type { Network, NodeInfo } from "./types";

type TriggerReorgButtonProps = {
	network: Network;
	nodes: NodeInfo[];
	buttonClassName?: string;
};

type StepStatus = "pending" | "active" | "done" | "error";

const blocks = (n: number) => `${n} ${n === 1 ? "block" : "blocks"}`;

const STEPS: {
	step: WorkflowStep;
	label: (reorgName: string, otherName: string, depth: number) => string;
}[] = [
	{ step: "disconnecting", label: (r) => `Disconnect ${r} from P2P` },
	{ step: "rewinding", label: (r, _, d) => `Rewind ${r} by ${blocks(d)}` },
	{
		step: "mining-private",
		label: (r, _, d) => `Mine ${blocks(d + 1)} replacement blocks on ${r}`,
	},
	{
		step: "reconsidering",
		label: (r) => `Reconsider old branch on ${r}`,
	},
	{ step: "reconnecting", label: (r) => `Reconnect ${r}` },
];

function getStepStatus(state: ReorgState, stepIdx: number): StepStatus {
	if (state.step === "idle") return "pending";
	if (state.step === "done") return "done";

	if (state.step === "error") {
		const failedIdx = state.failedStep
			? STEPS.findIndex((s) => s.step === state.failedStep)
			: 0;
		if (stepIdx < failedIdx) return "done";
		if (stepIdx === failedIdx) return "error";
		return "pending";
	}

	const currentIdx = STEPS.findIndex((s) => s.step === state.step);
	if (stepIdx < currentIdx) return "done";
	if (stepIdx === currentIdx) return "active";
	return "pending";
}

const STEP_STYLES: Record<StepStatus, string> = {
	pending: "text-muted-foreground",
	active: "font-medium",
	done: "text-muted-foreground line-through",
	error: "text-destructive font-medium",
};

function StepIcon({ status }: { status: StepStatus }) {
	switch (status) {
		case "done":
			return <CheckIcon className="size-4 text-emerald-500" />;
		case "active":
			return <Spinner className="size-4 text-foreground" />;
		case "error":
			return <XIcon className="size-4 text-destructive" />;
		case "pending":
			return <CircleIcon className="size-3.5 text-muted-foreground/40" />;
	}
}

export function TriggerReorgButton({
	network,
	nodes,
	buttonClassName,
}: TriggerReorgButtonProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [reorgNodeId, setReorgNodeId] = useState<string>("");
	const [depth, setDepth] = useState(1);
	const [excludeMempoolTransactions, setExcludeMempoolTransactions] =
		useState(false);
	const { triggerReorg, state, reset } = useTriggerReorg(network);

	const capableNodes = useMemo(
		() => nodes.filter((n) => n.supports_mining && n.supports_controls),
		[nodes],
	);
	const canExcludeTransactions = network.network_type === "Regtest";

	const reorgNode =
		capableNodes.find((n) => String(n.id) === reorgNodeId) ?? null;
	const otherNode =
		capableNodes.find((n) => String(n.id) !== reorgNodeId) ?? null;

	if (
		!isRegtestOrSignet(network) ||
		network.view_only_mode ||
		capableNodes.length < 2
	) {
		return null;
	}

	const isRunning =
		state.step !== "idle" && state.step !== "done" && state.step !== "error";
	const canStart =
		reorgNode !== null && otherNode !== null && depth >= 1 && !isRunning;

	const openDialog = () => {
		if (!reorgNodeId && capableNodes.length > 0)
			setReorgNodeId(String(capableNodes[0].id));
		setDialogOpen(true);
	};

	const handleOpenChange = (open: boolean) => {
		if (isRunning) return;
		if (!open) {
			reset();
			setReorgNodeId(capableNodes.length > 0 ? String(capableNodes[0].id) : "");
			setDepth(1);
			setExcludeMempoolTransactions(false);
		}
		setDialogOpen(open);
	};

	const handleStart = () => {
		if (!reorgNode || !otherNode) return;
		void triggerReorg({
			reorgNodeId: reorgNode.id,
			reorgNodeName: reorgNode.name,
			depth,
			excludeMempoolTransactions,
		});
	};

	return (
		<>
			<Button
				variant="outline"
				size="xs"
				className={cn("gap-1.5", buttonClassName)}
				onClick={openDialog}
			>
				<Shuffle className="size-3.5" />
				Trigger Reorg
			</Button>

			<Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
				<DialogContent
					showCloseButton={!isRunning}
					onClick={(e: React.MouseEvent) => e.stopPropagation()}
					onPointerDownOutside={
						isRunning ? (e) => e.preventDefault() : undefined
					}
					onEscapeKeyDown={isRunning ? (e) => e.preventDefault() : undefined}
				>
					<DialogHeader>
						<DialogTitle>Trigger Reorg</DialogTitle>
						<DialogDescription>
							Disconnect a node, rewind its current active chain to an older
							ancestor, mine a longer replacement branch there, then reconnect
							to trigger a real rollback-style reorganization.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 pt-1">
						<div className="space-y-2 flex flex-col">
							<div className="text-sm">Reorg Node</div>
							<Select
								value={reorgNodeId}
								onValueChange={setReorgNodeId}
								disabled={isRunning || state.step === "done"}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{capableNodes.map((node) => (
										<SelectItem key={node.id} value={String(node.id)}>
											{node.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5 flex flex-col">
							<div className="text-sm">Reorg Depth</div>
							<Input
								type="number"
								min={1}
								max={10}
								value={depth}
								onChange={(e) =>
									setDepth(
										Math.max(1, Math.min(10, Number(e.target.value) || 1)),
									)
								}
								disabled={isRunning || state.step === "done"}
							/>
							<p className="text-xs text-muted-foreground">
								The reorg node rewinds its current active chain by{" "}
								{blocks(depth)} and then mines {blocks(depth + 1)} replacement
								blocks from that older ancestor while disconnected.
							</p>
						</div>

						{canExcludeTransactions && (
							<label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
								<input
									type="checkbox"
									checked={excludeMempoolTransactions}
									onChange={(e) =>
										setExcludeMempoolTransactions(e.target.checked)
									}
									disabled={isRunning || state.step === "done"}
									className="mt-0.5 size-4"
								/>
								<div className="space-y-1">
									<div className="text-sm">
										Exclude mempool transactions from reorg blocks
									</div>
									<p className="text-xs text-muted-foreground">
										Mine empty replacement blocks during the reorg without
										re-broadcasting transactions from this app afterward.
									</p>
								</div>
							</label>
						)}

						{state.step !== "idle" && reorgNode && otherNode && (
							<div className="space-y-2 rounded-md border p-3">
								{STEPS.map((stepDef, idx) => {
									const status = getStepStatus(state, idx);
									return (
										<div
											key={stepDef.step}
											className="flex items-center gap-2.5"
										>
											<StepIcon status={status} />
											<span className={cn("text-sm", STEP_STYLES[status])}>
												{stepDef.label(reorgNode.name, otherNode.name, depth)}
											</span>
										</div>
									);
								})}
							</div>
						)}

						{state.step === "error" && state.error && (
							<p className="text-sm text-destructive">{state.error}</p>
						)}

						{state.step === "done" && (
							<p className="text-sm text-emerald-600 dark:text-emerald-400">
								Reorg complete. Check it out in the block graph.
							</p>
						)}
					</div>

					<DialogFooter>
						{state.step === "idle" && (
							<Button onClick={handleStart} disabled={!canStart}>
								Start Reorg
							</Button>
						)}
						{state.step === "error" && (
							<Button variant="outline" onClick={reset}>
								Try Again
							</Button>
						)}
						{state.step === "done" && (
							<Button variant="outline" onClick={() => handleOpenChange(false)}>
								Close
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
