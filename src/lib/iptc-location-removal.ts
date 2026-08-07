// Photoshop IRB / IPTC-IIM location removal (docs/FEATURE_SPECIFICATION.md
// F-005 "Remove Embedded Location Data"). Operates on the payload of a JPEG
// APP13 segment (src/lib/jpeg-location-metadata.ts extracts that payload
// and re-wraps the result — this module never sees the surrounding JPEG).
//
// Structure: a "Photoshop 3.0\0" signature, followed by a sequence of Image
// Resource Blocks ("8BIM" + 2-byte resource ID + Pascal-string name padded
// to even + 4-byte data size + data padded to even). Resource ID 0x0404 is
// the IPTC-NAA record: a sequence of IIM datasets (marker 0x1C + 1-byte
// record + 1-byte dataset + 2-byte length + payload). Only IIM Application
// Record (record 2) datasets 90 (City), 92 (Sub-location), 95
// (Province/State), 101 (Country/Primary Location Name) and 103
// (Country/Primary Location Code) are removed; every other resource block
// and every other dataset is preserved unchanged. An IIM dataset with the
// extended-length form (length field's high bit set, used only for values
// far larger than any of the targeted fields) is not parsed — it is
// reported as unsupported rather than guessed at.
//
// Parse-then-apply, strictly: `planIptcLocationRemoval` and everything it
// calls only ever read `payload` and compute a description of what would
// change (which resource block, which dataset ranges within it) — no
// output buffer is ever allocated during that analysis. Only once the
// whole structure has been read successfully does `applyIptcPlan` build
// the single new buffer, and only for the one resource block that actually
// needs a change; every other resource block is copied unchanged.
//
// Unlike EXIF removal, this can shrink the payload (a removed dataset is
// spliced out, not zero-filled in place) — IIM datasets are read
// sequentially by marker, not by fixed offset, so removing one cleanly
// keeps the remaining stream valid without leaving a dead, still-decodable
// dataset behind.

const PHOTOSHOP_PREFIX = "Photoshop 3.0\0";
const IRB_SIGNATURE = "8BIM";
const IPTC_NAA_RESOURCE_ID = 0x0404;
const IIM_MARKER = 0x1c;
const IIM_APPLICATION_RECORD = 2;
const IIM_LOCATION_DATASETS: ReadonlySet<number> = new Set([
	90, 92, 95, 101, 103,
]);
const EXTENDED_LENGTH_BIT = 0x8000;

export type IptcLocationRemovalError =
	| { readonly code: "malformed-irb" }
	| { readonly code: "irb-out-of-bounds" }
	| { readonly code: "unsupported-extended-dataset" };

export type IptcLocationRemovalResult =
	| { readonly ok: true; readonly bytes: Uint8Array }
	| { readonly ok: false; readonly error: IptcLocationRemovalError };

interface ByteRange {
	readonly start: number;
	readonly length: number;
}

interface IrbBlock {
	readonly blockStart: number;
	readonly blockEnd: number;
	readonly resourceId: number;
	readonly dataStart: number;
	readonly dataLength: number;
	readonly sizeFieldOffset: number;
}

interface IimDataset {
	readonly start: number;
	readonly end: number;
	readonly record: number;
	readonly dataset: number;
}

interface IptcPlan {
	readonly blocks: readonly IrbBlock[];
	readonly excludeDatasetRanges: readonly ByteRange[];
	readonly targetResourceIndex: number | undefined;
}

type PlanResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: IptcLocationRemovalError };

function matchesAsciiPrefix(
	bytes: Uint8Array,
	start: number,
	prefix: string,
): boolean {
	if (start + prefix.length > bytes.length) return false;
	const slice = bytes.subarray(start, start + prefix.length);
	return String.fromCharCode(...slice) === prefix;
}

function readPascalStringFieldLength(
	view: DataView,
	offset: number,
	bufferLength: number,
):
	| { readonly ok: true; readonly fieldLength: number }
	| { readonly ok: false } {
	if (offset >= bufferLength) return { ok: false };
	const nameLength = view.getUint8(offset);
	const rawTotal = 1 + nameLength;
	const fieldLength = rawTotal % 2 === 0 ? rawTotal : rawTotal + 1;
	if (offset + fieldLength > bufferLength) return { ok: false };
	return { ok: true, fieldLength };
}

function parseIrbBlocks(
	payload: Uint8Array,
	view: DataView,
): PlanResult<readonly IrbBlock[]> {
	if (!matchesAsciiPrefix(payload, 0, PHOTOSHOP_PREFIX)) {
		return { ok: false, error: { code: "malformed-irb" } };
	}
	const blocks: IrbBlock[] = [];
	let offset = PHOTOSHOP_PREFIX.length;

	while (offset < payload.length) {
		if (!matchesAsciiPrefix(payload, offset, IRB_SIGNATURE)) {
			return { ok: false, error: { code: "malformed-irb" } };
		}
		const resourceIdOffset = offset + IRB_SIGNATURE.length;
		if (resourceIdOffset + 2 > payload.length) {
			return { ok: false, error: { code: "irb-out-of-bounds" } };
		}
		const resourceId = view.getUint16(resourceIdOffset, false);
		const nameFieldOffset = resourceIdOffset + 2;
		const nameField = readPascalStringFieldLength(
			view,
			nameFieldOffset,
			payload.length,
		);
		if (!nameField.ok)
			return { ok: false, error: { code: "irb-out-of-bounds" } };

		const sizeFieldOffset = nameFieldOffset + nameField.fieldLength;
		if (sizeFieldOffset + 4 > payload.length) {
			return { ok: false, error: { code: "irb-out-of-bounds" } };
		}
		const dataLength = view.getUint32(sizeFieldOffset, false);
		const dataStart = sizeFieldOffset + 4;
		const paddedDataLength = dataLength % 2 === 0 ? dataLength : dataLength + 1;
		const blockEnd = dataStart + paddedDataLength;
		if (blockEnd > payload.length) {
			return { ok: false, error: { code: "irb-out-of-bounds" } };
		}

		blocks.push({
			blockStart: offset,
			blockEnd,
			resourceId,
			dataStart,
			dataLength,
			sizeFieldOffset,
		});
		offset = blockEnd;
	}

	return { ok: true, value: blocks };
}

function parseIimDatasets(
	view: DataView,
	dataStart: number,
	dataEnd: number,
): PlanResult<readonly IimDataset[]> {
	const datasets: IimDataset[] = [];
	let offset = dataStart;

	while (offset < dataEnd) {
		if (offset + 5 > dataEnd)
			return { ok: false, error: { code: "irb-out-of-bounds" } };
		if (view.getUint8(offset) !== IIM_MARKER) {
			return { ok: false, error: { code: "malformed-irb" } };
		}
		const record = view.getUint8(offset + 1);
		const dataset = view.getUint8(offset + 2);
		const lengthField = view.getUint16(offset + 3, false);
		if ((lengthField & EXTENDED_LENGTH_BIT) !== 0) {
			return { ok: false, error: { code: "unsupported-extended-dataset" } };
		}
		const end = offset + 5 + lengthField;
		if (end > dataEnd)
			return { ok: false, error: { code: "irb-out-of-bounds" } };
		datasets.push({ start: offset, end, record, dataset });
		offset = end;
	}

	return { ok: true, value: datasets };
}

function planIptcLocationRemoval(payload: Uint8Array): PlanResult<IptcPlan> {
	const view = new DataView(
		payload.buffer,
		payload.byteOffset,
		payload.byteLength,
	);
	const blocksResult = parseIrbBlocks(payload, view);
	if (!blocksResult.ok) return blocksResult;
	const blocks = blocksResult.value;

	const targetIndex = blocks.findIndex(
		(block) => block.resourceId === IPTC_NAA_RESOURCE_ID,
	);
	if (targetIndex === -1) {
		return {
			ok: true,
			value: {
				blocks,
				excludeDatasetRanges: [],
				targetResourceIndex: undefined,
			},
		};
	}
	const target = blocks[targetIndex];
	if (!target) {
		return {
			ok: true,
			value: {
				blocks,
				excludeDatasetRanges: [],
				targetResourceIndex: undefined,
			},
		};
	}

	const datasetsResult = parseIimDatasets(
		view,
		target.dataStart,
		target.dataStart + target.dataLength,
	);
	if (!datasetsResult.ok) return datasetsResult;

	const excludeRanges: ByteRange[] = [];
	for (const dataset of datasetsResult.value) {
		if (
			dataset.record === IIM_APPLICATION_RECORD &&
			IIM_LOCATION_DATASETS.has(dataset.dataset)
		) {
			excludeRanges.push({
				start: dataset.start,
				length: dataset.end - dataset.start,
			});
		}
	}

	return {
		ok: true,
		value: {
			blocks,
			excludeDatasetRanges: excludeRanges,
			targetResourceIndex: excludeRanges.length > 0 ? targetIndex : undefined,
		},
	};
}

function applyIptcPlan(payload: Uint8Array, plan: IptcPlan): Uint8Array {
	if (plan.targetResourceIndex === undefined) {
		return payload.slice();
	}
	const parts: Uint8Array[] = [payload.subarray(0, PHOTOSHOP_PREFIX.length)];
	const sortedExcludes = [...plan.excludeDatasetRanges].sort(
		(a, b) => a.start - b.start,
	);

	for (let index = 0; index < plan.blocks.length; index += 1) {
		const block = plan.blocks[index];
		if (!block) continue;
		if (index !== plan.targetResourceIndex) {
			parts.push(payload.subarray(block.blockStart, block.blockEnd));
			continue;
		}

		const newData: Uint8Array[] = [];
		let cursor = block.dataStart;
		for (const range of sortedExcludes) {
			if (range.start > cursor)
				newData.push(payload.subarray(cursor, range.start));
			cursor = range.start + range.length;
		}
		const dataEnd = block.dataStart + block.dataLength;
		if (cursor < dataEnd) newData.push(payload.subarray(cursor, dataEnd));

		const newDataLength = newData.reduce((sum, part) => sum + part.length, 0);
		const header = payload.subarray(block.blockStart, block.sizeFieldOffset);
		const sizeField = new Uint8Array(4);
		new DataView(sizeField.buffer).setUint32(0, newDataLength, false);

		parts.push(header, sizeField, ...newData);
		if (newDataLength % 2 !== 0) parts.push(new Uint8Array([0]));
	}

	const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
	const output = new Uint8Array(totalLength);
	let writeOffset = 0;
	for (const part of parts) {
		output.set(part, writeOffset);
		writeOffset += part.length;
	}
	return output;
}

export function removeIptcLocation(
	app13Payload: Uint8Array,
): IptcLocationRemovalResult {
	const planResult = planIptcLocationRemoval(app13Payload);
	if (!planResult.ok) return planResult;
	return { ok: true, bytes: applyIptcPlan(app13Payload, planResult.value) };
}
