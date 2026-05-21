import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { buildMempoolItemUrl } from "./networkAccess";
import type { Network } from "./types";

type MempoolHashLinkProps = {
	network: Network;
	hash: string;
	itemType: "block" | "tx";
	children?: ReactNode;
	className?: string;
	title?: string;
	stopPropagation?: boolean;
};

export function MempoolHashLink({
	network,
	hash,
	itemType,
	children,
	className,
	title,
	stopPropagation = false,
}: MempoolHashLinkProps) {
	const href = buildMempoolItemUrl(network, itemType, hash);

	if (!href) {
		return <>{children ?? hash}</>;
	}

	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			title={title}
			className={className}
			onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
		>
			{children ?? hash}
			<ExternalLinkIcon className="size-3 shrink-0" />
		</a>
	);
}
