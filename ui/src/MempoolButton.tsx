import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMempoolWebUrl } from "./networkAccess";
import type { Network } from "./types";

type MempoolButtonProps = {
	network: Network;
	buttonClassName?: string;
};

export function MempoolButton({
	network,
	buttonClassName,
}: MempoolButtonProps) {
	const mempoolUrl = resolveMempoolWebUrl(network);

	if (network.network_type !== "Regtest" || !mempoolUrl) {
		return null;
	}

	return (
		<Button asChild variant="outline" size="xs" className={buttonClassName}>
			<a
				href={mempoolUrl}
				target="_blank"
				rel="noreferrer"
				aria-label="Open regtest mempool.space instance"
				title="Open regtest mempool.space instance"
			>
				<ExternalLinkIcon className="size-3.5" />
				Open Mempool
			</a>
		</Button>
	);
}
