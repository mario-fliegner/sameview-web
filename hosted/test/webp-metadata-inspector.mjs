// Independent WebP RIFF-chunk inspector — used only by tests, to prove
// metadata absence in processed output without relying on the processing
// implementation (sharp) to check its own work. A from-scratch byte-level
// reader of WebP's RIFF container format, deliberately not sharp's own
// `.metadata()` — the same independent-verification principle already
// established by the project's own hand-written JPEG-marker walker
// (src/lib/jpeg-segments.ts), applied to WebP's structurally different
// container format.
//
// WebP layout: 4 bytes "RIFF", 4-byte little-endian file size, 4 bytes
// "WEBP", then a sequence of chunks, each: 4-byte FourCC, 4-byte
// little-endian chunk size, chunk data (padded to an even byte boundary).

const METADATA_FOURCCS = new Set(["EXIF", "XMP ", "ICCP"]);

/**
 * @param {Buffer} buffer
 * @returns {string[]} FourCCs of any metadata chunks found (EXIF/XMP /ICCP)
 */
export function findWebpMetadataChunks(buffer) {
	if (
		buffer.length < 12 ||
		buffer.toString("ascii", 0, 4) !== "RIFF" ||
		buffer.toString("ascii", 8, 12) !== "WEBP"
	) {
		throw new Error("Not a WebP file (missing RIFF/WEBP header)");
	}

	const found = [];
	let offset = 12;
	while (offset + 8 <= buffer.length) {
		const fourCC = buffer.toString("ascii", offset, offset + 4);
		const chunkSize = buffer.readUInt32LE(offset + 4);
		if (METADATA_FOURCCS.has(fourCC)) {
			found.push(fourCC);
		}
		// Chunks are padded to an even byte boundary.
		const paddedSize = chunkSize + (chunkSize % 2);
		offset += 8 + paddedSize;
	}
	return found;
}

/**
 * @param {Buffer} buffer
 */
export function assertNoWebpMetadata(buffer) {
	const found = findWebpMetadataChunks(buffer);
	if (found.length > 0) {
		throw new Error(
			`WebP output unexpectedly contains metadata chunk(s): ${found.join(", ")}`,
		);
	}
}
