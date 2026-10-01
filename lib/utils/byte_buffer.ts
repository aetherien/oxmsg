/**
 * Minimal ByteBuffer replacement for the bytebuffer npm package.
 * Uses DataView over a plain Uint8Array — no deprecated Buffer() calls.
 * All multi-byte values are little-endian (LITTLE_ENDIAN = true).
 */

const GROWTH_FACTOR = 2
const DEFAULT_CAPACITY = 16

export class ByteBuffer {
    static readonly LITTLE_ENDIAN = true

    /** Always true — this implementation is little-endian only. */
    readonly littleEndian = true

    /** Raw backing store. May be larger than `limit`. */
    private _buf: Uint8Array
    private _view: DataView

    /** Current read/write cursor. */
    offset: number
    /** One past the last valid byte for reading. */
    limit: number
    /** Saved position from mark(). -1 if unset. */
    markedOffset: number

    constructor(capacity: number = DEFAULT_CAPACITY, _littleEndian: boolean = true) {
        const cap = Math.max(capacity, 1)
        this._buf = new Uint8Array(cap)
        this._view = new DataView(this._buf.buffer, this._buf.byteOffset, this._buf.byteLength)
        this.offset = 0
        this.limit = cap
        this.markedOffset = -1
    }

    // ── factories ─────────────────────────────────────────────────────────

    static wrap(data: Uint8Array<ArrayBuffer> | ArrayBuffer | ByteBuffer, _encoding?: unknown, _littleEndian?: boolean): ByteBuffer {
        if (data instanceof ByteBuffer) {
            // Wrap the backing store of the source buffer, preserving its offset and limit
            const u8 = data._buf.subarray(0, data.limit)
            const bb = new ByteBuffer(0)
            bb._buf = u8
            bb._view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
            bb.offset = data.offset
            bb.limit = data.limit
            return bb
        }
        let u8: Uint8Array
        if (data instanceof ArrayBuffer) {
            u8 = new Uint8Array(data)
        } else {
            u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        }
        const bb = new ByteBuffer(0)
        bb._buf = u8
        bb._view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
        bb.offset = 0
        bb.limit = u8.byteLength
        return bb
    }

    static fromHex(hex: string, _littleEndian?: boolean): ByteBuffer {
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
        }
        return ByteBuffer.wrap(bytes)
    }


    // ── capacity / position ───────────────────────────────────────────────

    ensureCapacity(capacity: number): this {
        if (this._buf.byteLength < capacity) {
            const next = new Uint8Array(Math.max(capacity, this._buf.byteLength * GROWTH_FACTOR))
            next.set(this._buf)
            this._buf = next
            this._view = new DataView(next.buffer, next.byteOffset, next.byteLength)
        }
        this.limit = Math.max(this.limit, capacity)
        return this
    }

    mark(_offset?: number): this { this.markedOffset = this.offset; return this }
    reset(): this { if (this.markedOffset >= 0) this.offset = this.markedOffset; return this }
    clear(): this { this.offset = 0; this.limit = this._buf.byteLength; this.markedOffset = -1; return this }

    slice(begin: number, end: number): ByteBuffer {
        const sliced = this._buf.slice(begin, end)
        const bb = new ByteBuffer(0)
        bb._buf = sliced
        bb._view = new DataView(sliced.buffer, sliced.byteOffset, sliced.byteLength)
        bb.offset = 0
        bb.limit = sliced.byteLength
        return bb
    }
    // ── write ─────────────────────────────────────────────────────────────

    writeUint8(value: number, offset?: number): this {
        const at = offset ?? this.offset
        this._grow(at + 1)
        this._view.setUint8(at, value & 0xff)
        if (offset == null) this.offset = at + 1
        return this
    }

    writeUint16(value: number, offset?: number): this {
        const at = offset ?? this.offset
        this._grow(at + 2)
        this._view.setUint16(at, value & 0xffff, true)
        if (offset == null) this.offset = at + 2
        return this
    }

    writeInt32(value: number, offset?: number): this {
        const at = offset ?? this.offset
        this._grow(at + 4)
        this._view.setInt32(at, value, true)
        if (offset == null) this.offset = at + 4
        return this
    }

    writeUint32(value: number, offset?: number): this {
        const at = offset ?? this.offset
        this._grow(at + 4)
        this._view.setUint32(at, value >>> 0, true)
        if (offset == null) this.offset = at + 4
        return this
    }

    writeUint64(value: number | bigint, offset?: number): this {
        const at = offset ?? this.offset
        this._grow(at + 8)
        const big = typeof value === 'bigint' ? value : BigInt(value)
        const lo = Number(big & 0xffffffffn) >>> 0
        const hi = Number((big >> 32n) & 0xffffffffn) >>> 0
        this._view.setUint32(at, lo, true)
        this._view.setUint32(at + 4, hi, true)
        if (offset == null) this.offset = at + 8
        return this
    }

    writeUTF8String(str: string, offset?: number): this | number {
        const encoded = new TextEncoder().encode(str)
        const at = offset ?? this.offset
        this._grow(at + encoded.byteLength)
        this._buf.set(encoded, at)
        if (offset == null) {
            this.offset = at + encoded.byteLength
            return this
        }
        return at + encoded.byteLength
    }

    /** Alias for writeUTF8String (matches bytebuffer API). */
    writeString(str: string, offset?: number): this | number {
        return this.writeUTF8String(str, offset)
    }

    append(data: Uint8Array | ByteBuffer): this {
        const src = data instanceof ByteBuffer
            ? data._buf.subarray(data.offset, data.limit)
            : data
        const at = this.offset
        this._grow(at + src.byteLength)
        this._buf.set(src, at)
        this.offset = at + src.byteLength
        return this
    }

    // ── read ──────────────────────────────────────────────────────────────

    readUint8(offset?: number): number {
        const at = offset ?? this.offset
        const v = this._view.getUint8(at)
        if (offset == null) this.offset = at + 1
        return v
    }

    readUint16(offset?: number): number {
        const at = offset ?? this.offset
        const v = this._view.getUint16(at, true)
        if (offset == null) this.offset = at + 2
        return v
    }

    readUint32(offset?: number): number {
        const at = offset ?? this.offset
        const v = this._view.getUint32(at, true)
        if (offset == null) this.offset = at + 4
        return v
    }

    readUTF8String(byteLength: number): string {
        const slice = this._buf.subarray(this.offset, this.offset + byteLength)
        this.offset += byteLength
        return new TextDecoder().decode(slice)
    }

    // ── export ────────────────────────────────────────────────────────────

    toBuffer(forceCopy: boolean = false): Buffer {
        const slice = this._buf.subarray(0, this.limit)
        return forceCopy
            ? Buffer.from(slice)
            : Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength)
    }

    toArrayBuffer(forceCopy: boolean = false): ArrayBuffer {
        const slice = this._buf.subarray(0, this.limit)
        return forceCopy
            ? slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) as ArrayBuffer
            : slice.buffer as ArrayBuffer
    }

    toDebug(): string {
        const hexBytes = Array.from(this._buf.subarray(0, this.limit))
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        const before = hexBytes.slice(0, this.offset).join(' ')
        const after = hexBytes.slice(this.offset).join(' ')
        const afterPart = after || '00'
        return before ? `${before}<${afterPart}>` : `<${afterPart}>`
    }

    // ── internal ─────────────────────────────────────────────────────────

    private _grow(needed: number): void {
        if (needed > this._buf.byteLength) {
            const next = new Uint8Array(Math.max(needed, this._buf.byteLength * GROWTH_FACTOR))
            next.set(this._buf)
            this._buf = next
            this._view = new DataView(next.buffer, next.byteOffset, next.byteLength)
        }
        if (needed > this.limit) this.limit = needed
    }
}

