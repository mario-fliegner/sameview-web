// Turns imported comparison image bytes into a browser-displayable <img src>
// (docs/FEATURE_SPECIFICATION.md F-002), with automatic cleanup. One small
// hook, reused for the reference and capture images now, and for a branding
// image later (Phase 6).
//
// Deliberately not a concept the reusable ComparisonSlider component knows
// about: that component only ever receives a plain `src: string`, so the
// exact same component can later be reused to render the Standalone HTML
// export (Phase 9), which needs a `data:` URI instead — a blob URL doesn't
// survive outside the page that created it.

import { useEffect, useState } from "react";

export function useObjectUrl(
	bytes: Uint8Array | undefined,
): string | undefined {
	const [url, setUrl] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (!bytes) {
			setUrl(undefined);
			return;
		}
		// The cast works around Uint8Array's ArrayBufferLike generic (which
		// includes SharedArrayBuffer) not structurally matching BlobPart; the
		// bytes handled here are always a plain ArrayBuffer-backed view — the
		// identical cast is already used in src/lib/import-image.ts.
		const objectUrl = URL.createObjectURL(
			new Blob([bytes as unknown as BlobPart]),
		);
		setUrl(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [bytes]);

	return url;
}
