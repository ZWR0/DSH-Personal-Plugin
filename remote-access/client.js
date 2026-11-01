/**
 * Client half of Remote Access.
 *
 * Manages the DSH Web launch token and the public base URL. The Host keeps the
 * credential and performs token validation; this page never stores a token in
 * the browser and asks for the full token only on an explicit reveal, copy, or QR display.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-remote-access',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    // Bundled QR encoder: Project Nayuki, MIT. No runtime network dependency.
    /*
     * QR Code generator library (TypeScript)
     *
     * Copyright (c) Project Nayuki. (MIT License)
     * https://www.nayuki.io/page/qr-code-generator-library
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy of
     * this software and associated documentation files (the "Software"), to deal in
     * the Software without restriction, including without limitation the rights to
     * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
     * the Software, and to permit persons to whom the Software is furnished to do so,
     * subject to the following conditions:
     * - The above copyright notice and this permission notice shall be included in
     *   all copies or substantial portions of the Software.
     * - The Software is provided "as is", without warranty of any kind, express or
     *   implied, including but not limited to the warranties of merchantability,
     *   fitness for a particular purpose and noninfringement. In no event shall the
     *   authors or copyright holders be liable for any claim, damages or other
     *   liability, whether in an action of contract, tort or otherwise, arising from,
     *   out of or in connection with the Software or the use or other dealings in the
     *   Software.
     */
    "use strict";
    var qrcodegen;
    (function (qrcodegen) {
        /*---- QR Code symbol class ----*/
        /*
         * A QR Code symbol, which is a type of two-dimension barcode.
         * Invented by Denso Wave and described in the ISO/IEC 18004 standard.
         * Instances of this class represent an immutable square grid of dark and light cells.
         * The class provides static factory functions to create a QR Code from text or binary data.
         * The class covers the QR Code Model 2 specification, supporting all versions (sizes)
         * from 1 to 40, all 4 error correction levels, and 4 character encoding modes.
         *
         * Ways to create a QR Code object:
         * - High level: Take the payload data and call QrCode.encodeText() or QrCode.encodeBinary().
         * - Mid level: Custom-make the list of segments and call QrCode.encodeSegments().
         * - Low level: Custom-make the array of data codeword bytes (including
         *   segment headers and final padding, excluding error correction codewords),
         *   supply the appropriate version number, and call the QrCode() constructor.
         * (Note that all ways require supplying the desired error correction level.)
         */
        class QrCode {
            /*-- Static factory functions (high level) --*/
            // Returns a QR Code representing the given Unicode text string at the given error correction level.
            // As a conservative upper bound, this function is guaranteed to succeed for strings that have 738 or fewer
            // Unicode code points (not UTF-16 code units) if the low error correction level is used. The smallest possible
            // QR Code version is automatically chosen for the output. The ECC level of the result may be higher than the
            // ecl argument if it can be done without increasing the version.
            static encodeText(text, ecl) {
                const segs = qrcodegen.QrSegment.makeSegments(text);
                return QrCode.encodeSegments(segs, ecl);
            }
            // Returns a QR Code representing the given binary data at the given error correction level.
            // This function always encodes using the binary segment mode, not any text mode. The maximum number of
            // bytes allowed is 2953. The smallest possible QR Code version is automatically chosen for the output.
            // The ECC level of the result may be higher than the ecl argument if it can be done without increasing the version.
            static encodeBinary(data, ecl) {
                const seg = qrcodegen.QrSegment.makeBytes(data);
                return QrCode.encodeSegments([seg], ecl);
            }
            /*-- Static factory functions (mid level) --*/
            // Returns a QR Code representing the given segments with the given encoding parameters.
            // The smallest possible QR Code version within the given range is automatically
            // chosen for the output. Iff boostEcl is true, then the ECC level of the result
            // may be higher than the ecl argument if it can be done without increasing the
            // version. The mask number is either between 0 to 7 (inclusive) to force that
            // mask, or -1 to automatically choose an appropriate mask (which may be slow).
            // This function allows the user to create a custom sequence of segments that switches
            // between modes (such as alphanumeric and byte) to encode text in less space.
            // This is a mid-level API; the high-level API is encodeText() and encodeBinary().
            static encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
                if (!(QrCode.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= QrCode.MAX_VERSION)
                    || mask < -1 || mask > 7)
                    throw new RangeError("Invalid value");
                // Find the minimal version number to use
                let version;
                let dataUsedBits;
                for (version = minVersion;; version++) {
                    const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8; // Number of data bits available
                    const usedBits = QrSegment.getTotalBits(segs, version);
                    if (usedBits <= dataCapacityBits) {
                        dataUsedBits = usedBits;
                        break; // This version number is found to be suitable
                    }
                    if (version >= maxVersion) // All versions in the range could not fit the given data
                        throw new RangeError("Data too long");
                }
                // Increase the error correction level while the data still fits in the current version number
                for (const newEcl of [QrCode.Ecc.MEDIUM, QrCode.Ecc.QUARTILE, QrCode.Ecc.HIGH]) { // From low to high
                    if (boostEcl && dataUsedBits <= QrCode.getNumDataCodewords(version, newEcl) * 8)
                        ecl = newEcl;
                }
                // Concatenate all segments to create the data bit string
                let bb = [];
                for (const seg of segs) {
                    appendBits(seg.mode.modeBits, 4, bb);
                    appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
                    for (const b of seg.getData())
                        bb.push(b);
                }
                assert(bb.length == dataUsedBits);
                // Add terminator and pad up to a byte if applicable
                const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
                assert(bb.length <= dataCapacityBits);
                appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
                appendBits(0, (8 - bb.length % 8) % 8, bb);
                assert(bb.length % 8 == 0);
                // Pad with alternating bytes until data capacity is reached
                for (let padByte = 0xEC; bb.length < dataCapacityBits; padByte ^= 0xEC ^ 0x11)
                    appendBits(padByte, 8, bb);
                // Pack bits into bytes in big endian
                let dataCodewords = [];
                while (dataCodewords.length * 8 < bb.length)
                    dataCodewords.push(0);
                bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << (7 - (i & 7)));
                // Create the QR Code object
                return new QrCode(version, ecl, dataCodewords, mask);
            }
            /*-- Constructor (low level) and fields --*/
            // Creates a new QR Code with the given version number,
            // error correction level, data codeword bytes, and mask number.
            // This is a low-level API that most users should not use directly.
            // A mid-level API is the encodeSegments() function.
            constructor(
            // The version number of this QR Code, which is between 1 and 40 (inclusive).
            // This determines the size of this barcode.
            version,
            // The error correction level used in this QR Code.
            errorCorrectionLevel, dataCodewords, msk) {
                this.version = version;
                this.errorCorrectionLevel = errorCorrectionLevel;
                // The modules of this QR Code (false = light, true = dark).
                // Immutable after constructor finishes. Accessed through getModule().
                this.modules = [];
                // Indicates function modules that are not subjected to masking. Discarded when constructor finishes.
                this.isFunction = [];
                // Check scalar arguments
                if (version < QrCode.MIN_VERSION || version > QrCode.MAX_VERSION)
                    throw new RangeError("Version value out of range");
                if (msk < -1 || msk > 7)
                    throw new RangeError("Mask value out of range");
                this.size = version * 4 + 17;
                // Initialize both grids to be size*size arrays of Boolean false
                let row = [];
                for (let i = 0; i < this.size; i++)
                    row.push(false);
                for (let i = 0; i < this.size; i++) {
                    this.modules.push(row.slice()); // Initially all light
                    this.isFunction.push(row.slice());
                }
                // Compute ECC, draw modules
                this.drawFunctionPatterns();
                const allCodewords = this.addEccAndInterleave(dataCodewords);
                this.drawCodewords(allCodewords);
                // Do masking
                if (msk == -1) { // Automatically choose best mask
                    let minPenalty = 1000000000;
                    for (let i = 0; i < 8; i++) {
                        this.applyMask(i);
                        this.drawFormatBits(i);
                        const penalty = this.getPenaltyScore();
                        if (penalty < minPenalty) {
                            msk = i;
                            minPenalty = penalty;
                        }
                        this.applyMask(i); // Undoes the mask due to XOR
                    }
                }
                assert(0 <= msk && msk <= 7);
                this.mask = msk;
                this.applyMask(msk); // Apply the final choice of mask
                this.drawFormatBits(msk); // Overwrite old format bits
                this.isFunction = [];
            }
            /*-- Accessor methods --*/
            // Returns the color of the module (pixel) at the given coordinates, which is false
            // for light or true for dark. The top left corner has the coordinates (x=0, y=0).
            // If the given coordinates are out of bounds, then false (light) is returned.
            getModule(x, y) {
                return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
            }
            /*-- Private helper methods for constructor: Drawing function modules --*/
            // Reads this object's version field, and draws and marks all function modules.
            drawFunctionPatterns() {
                // Draw horizontal and vertical timing patterns
                for (let i = 0; i < this.size; i++) {
                    this.setFunctionModule(6, i, i % 2 == 0);
                    this.setFunctionModule(i, 6, i % 2 == 0);
                }
                // Draw 3 finder patterns (all corners except bottom right; overwrites some timing modules)
                this.drawFinderPattern(3, 3);
                this.drawFinderPattern(this.size - 4, 3);
                this.drawFinderPattern(3, this.size - 4);
                // Draw numerous alignment patterns
                const alignPatPos = this.getAlignmentPatternPositions();
                const numAlign = alignPatPos.length;
                for (let i = 0; i < numAlign; i++) {
                    for (let j = 0; j < numAlign; j++) {
                        // Don't draw on the three finder corners
                        if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0))
                            this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
                    }
                }
                // Draw configuration data
                this.drawFormatBits(0); // Dummy mask value; overwritten later in the constructor
                this.drawVersion();
            }
            // Draws two copies of the format bits (with its own error correction code)
            // based on the given mask and this object's error correction level field.
            drawFormatBits(mask) {
                // Calculate error correction code and pack bits
                const data = this.errorCorrectionLevel.formatBits << 3 | mask; // errCorrLvl is uint2, mask is uint3
                let rem = data;
                for (let i = 0; i < 10; i++)
                    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
                const bits = (data << 10 | rem) ^ 0x5412; // uint15
                assert(bits >>> 15 == 0);
                // Draw first copy
                for (let i = 0; i <= 5; i++)
                    this.setFunctionModule(8, i, getBit(bits, i));
                this.setFunctionModule(8, 7, getBit(bits, 6));
                this.setFunctionModule(8, 8, getBit(bits, 7));
                this.setFunctionModule(7, 8, getBit(bits, 8));
                for (let i = 9; i < 15; i++)
                    this.setFunctionModule(14 - i, 8, getBit(bits, i));
                // Draw second copy
                for (let i = 0; i < 8; i++)
                    this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
                for (let i = 8; i < 15; i++)
                    this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
                this.setFunctionModule(8, this.size - 8, true); // Always dark
            }
            // Draws two copies of the version bits (with its own error correction code),
            // based on this object's version field, iff 7 <= version <= 40.
            drawVersion() {
                if (this.version < 7)
                    return;
                // Calculate error correction code and pack bits
                let rem = this.version; // version is uint6, in the range [7, 40]
                for (let i = 0; i < 12; i++)
                    rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
                const bits = this.version << 12 | rem; // uint18
                assert(bits >>> 18 == 0);
                // Draw two copies
                for (let i = 0; i < 18; i++) {
                    const color = getBit(bits, i);
                    const a = this.size - 11 + i % 3;
                    const b = Math.floor(i / 3);
                    this.setFunctionModule(a, b, color);
                    this.setFunctionModule(b, a, color);
                }
            }
            // Draws a 9*9 finder pattern including the border separator,
            // with the center module at (x, y). Modules can be out of bounds.
            drawFinderPattern(x, y) {
                for (let dy = -4; dy <= 4; dy++) {
                    for (let dx = -4; dx <= 4; dx++) {
                        const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev/infinity norm
                        const xx = x + dx;
                        const yy = y + dy;
                        if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
                            this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
                    }
                }
            }
            // Draws a 5*5 alignment pattern, with the center module
            // at (x, y). All modules must be in bounds.
            drawAlignmentPattern(x, y) {
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++)
                        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
                }
            }
            // Sets the color of a module and marks it as a function module.
            // Only used by the constructor. Coordinates must be in bounds.
            setFunctionModule(x, y, isDark) {
                this.modules[y][x] = isDark;
                this.isFunction[y][x] = true;
            }
            /*-- Private helper methods for constructor: Codewords and masking --*/
            // Returns a new byte string representing the given data with the appropriate error correction
            // codewords appended to it, based on this object's version and error correction level.
            addEccAndInterleave(data) {
                const ver = this.version;
                const ecl = this.errorCorrectionLevel;
                if (data.length != QrCode.getNumDataCodewords(ver, ecl))
                    throw new RangeError("Invalid argument");
                // Calculate parameter numbers
                const numBlocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
                const blockEccLen = QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
                const rawCodewords = Math.floor(QrCode.getNumRawDataModules(ver) / 8);
                const numShortBlocks = numBlocks - rawCodewords % numBlocks;
                const shortBlockLen = Math.floor(rawCodewords / numBlocks);
                // Split data into blocks and append ECC to each block
                let blocks = [];
                const rsDiv = QrCode.reedSolomonComputeDivisor(blockEccLen);
                for (let i = 0, k = 0; i < numBlocks; i++) {
                    let dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
                    k += dat.length;
                    const ecc = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
                    if (i < numShortBlocks)
                        dat.push(0);
                    blocks.push(dat.concat(ecc));
                }
                // Interleave (not concatenate) the bytes from every block into a single sequence
                let result = [];
                for (let i = 0; i < blocks[0].length; i++) {
                    blocks.forEach((block, j) => {
                        // Skip the padding byte in short blocks
                        if (i != shortBlockLen - blockEccLen || j >= numShortBlocks)
                            result.push(block[i]);
                    });
                }
                assert(result.length == rawCodewords);
                return result;
            }
            // Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
            // data area of this QR Code. Function modules need to be marked off before this is called.
            drawCodewords(data) {
                if (data.length != Math.floor(QrCode.getNumRawDataModules(this.version) / 8))
                    throw new RangeError("Invalid argument");
                let i = 0; // Bit index into the data
                // Do the funny zigzag scan
                for (let right = this.size - 1; right >= 1; right -= 2) { // Index of right column in each column pair
                    if (right == 6)
                        right = 5;
                    for (let vert = 0; vert < this.size; vert++) { // Vertical counter
                        for (let j = 0; j < 2; j++) {
                            const x = right - j; // Actual x coordinate
                            const upward = ((right + 1) & 2) == 0;
                            const y = upward ? this.size - 1 - vert : vert; // Actual y coordinate
                            if (!this.isFunction[y][x] && i < data.length * 8) {
                                this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
                                i++;
                            }
                            // If this QR Code has any remainder bits (0 to 7), they were assigned as
                            // 0/false/light by the constructor and are left unchanged by this method
                        }
                    }
                }
                assert(i == data.length * 8);
            }
            // XORs the codeword modules in this QR Code with the given mask pattern.
            // The function modules must be marked and the codeword bits must be drawn
            // before masking. Due to the arithmetic of XOR, calling applyMask() with
            // the same mask value a second time will undo the mask. A final well-formed
            // QR Code needs exactly one (not zero, two, etc.) mask applied.
            applyMask(mask) {
                if (mask < 0 || mask > 7)
                    throw new RangeError("Mask value out of range");
                for (let y = 0; y < this.size; y++) {
                    for (let x = 0; x < this.size; x++) {
                        let invert;
                        switch (mask) {
                            case 0:
                                invert = (x + y) % 2 == 0;
                                break;
                            case 1:
                                invert = y % 2 == 0;
                                break;
                            case 2:
                                invert = x % 3 == 0;
                                break;
                            case 3:
                                invert = (x + y) % 3 == 0;
                                break;
                            case 4:
                                invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
                                break;
                            case 5:
                                invert = x * y % 2 + x * y % 3 == 0;
                                break;
                            case 6:
                                invert = (x * y % 2 + x * y % 3) % 2 == 0;
                                break;
                            case 7:
                                invert = ((x + y) % 2 + x * y % 3) % 2 == 0;
                                break;
                            default: throw new Error("Unreachable");
                        }
                        if (!this.isFunction[y][x] && invert)
                            this.modules[y][x] = !this.modules[y][x];
                    }
                }
            }
            // Calculates and returns the penalty score based on state of this QR Code's current modules.
            // This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
            getPenaltyScore() {
                let result = 0;
                // Adjacent modules in row having same color, and finder-like patterns
                for (let y = 0; y < this.size; y++) {
                    let runColor = false;
                    let runX = 0;
                    let runHistory = [0, 0, 0, 0, 0, 0, 0];
                    for (let x = 0; x < this.size; x++) {
                        if (this.modules[y][x] == runColor) {
                            runX++;
                            if (runX == 5)
                                result += QrCode.PENALTY_N1;
                            else if (runX > 5)
                                result++;
                        }
                        else {
                            this.finderPenaltyAddHistory(runX, runHistory);
                            if (!runColor)
                                result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
                            runColor = this.modules[y][x];
                            runX = 1;
                        }
                    }
                    result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * QrCode.PENALTY_N3;
                }
                // Adjacent modules in column having same color, and finder-like patterns
                for (let x = 0; x < this.size; x++) {
                    let runColor = false;
                    let runY = 0;
                    let runHistory = [0, 0, 0, 0, 0, 0, 0];
                    for (let y = 0; y < this.size; y++) {
                        if (this.modules[y][x] == runColor) {
                            runY++;
                            if (runY == 5)
                                result += QrCode.PENALTY_N1;
                            else if (runY > 5)
                                result++;
                        }
                        else {
                            this.finderPenaltyAddHistory(runY, runHistory);
                            if (!runColor)
                                result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
                            runColor = this.modules[y][x];
                            runY = 1;
                        }
                    }
                    result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * QrCode.PENALTY_N3;
                }
                // 2*2 blocks of modules having same color
                for (let y = 0; y < this.size - 1; y++) {
                    for (let x = 0; x < this.size - 1; x++) {
                        const color = this.modules[y][x];
                        if (color == this.modules[y][x + 1] &&
                            color == this.modules[y + 1][x] &&
                            color == this.modules[y + 1][x + 1])
                            result += QrCode.PENALTY_N2;
                    }
                }
                // Balance of dark and light modules
                let dark = 0;
                for (const row of this.modules)
                    dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
                const total = this.size * this.size; // Note that size is odd, so dark/total != 1/2
                // Compute the smallest integer k >= 0 such that (45-5k)% <= dark/total <= (55+5k)%
                const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
                assert(0 <= k && k <= 9);
                result += k * QrCode.PENALTY_N4;
                assert(0 <= result && result <= 2568888); // Non-tight upper bound based on default values of PENALTY_N1, ..., N4
                return result;
            }
            /*-- Private helper functions --*/
            // Returns an ascending list of positions of alignment patterns for this version number.
            // Each position is in the range [0,177), and are used on both the x and y axes.
            // This could be implemented as lookup table of 40 variable-length lists of integers.
            getAlignmentPatternPositions() {
                if (this.version == 1)
                    return [];
                else {
                    const numAlign = Math.floor(this.version / 7) + 2;
                    const step = Math.floor((this.version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
                    let result = [6];
                    for (let pos = this.size - 7; result.length < numAlign; pos -= step)
                        result.splice(1, 0, pos);
                    return result;
                }
            }
            // Returns the number of data bits that can be stored in a QR Code of the given version number, after
            // all function modules are excluded. This includes remainder bits, so it might not be a multiple of 8.
            // The result is in the range [208, 29648]. This could be implemented as a 40-entry lookup table.
            static getNumRawDataModules(ver) {
                if (ver < QrCode.MIN_VERSION || ver > QrCode.MAX_VERSION)
                    throw new RangeError("Version number out of range");
                let result = (16 * ver + 128) * ver + 64;
                if (ver >= 2) {
                    const numAlign = Math.floor(ver / 7) + 2;
                    result -= (25 * numAlign - 10) * numAlign - 55;
                    if (ver >= 7)
                        result -= 36;
                }
                assert(208 <= result && result <= 29648);
                return result;
            }
            // Returns the number of 8-bit data (i.e. not error correction) codewords contained in any
            // QR Code of the given version number and error correction level, with remainder bits discarded.
            // This stateless pure function could be implemented as a (40*4)-cell lookup table.
            static getNumDataCodewords(ver, ecl) {
                return Math.floor(QrCode.getNumRawDataModules(ver) / 8) -
                    QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] *
                        QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
            }
            // Returns a Reed-Solomon ECC generator polynomial for the given degree. This could be
            // implemented as a lookup table over all possible parameter values, instead of as an algorithm.
            static reedSolomonComputeDivisor(degree) {
                if (degree < 1 || degree > 255)
                    throw new RangeError("Degree out of range");
                // Polynomial coefficients are stored from highest to lowest power, excluding the leading term which is always 1.
                // For example the polynomial x^3 + 255x^2 + 8x + 93 is stored as the uint8 array [255, 8, 93].
                let result = [];
                for (let i = 0; i < degree - 1; i++)
                    result.push(0);
                result.push(1); // Start off with the monomial x^0
                // Compute the product polynomial (x - r^0) * (x - r^1) * (x - r^2) * ... * (x - r^{degree-1}),
                // and drop the highest monomial term which is always 1x^degree.
                // Note that r = 0x02, which is a generator element of this field GF(2^8/0x11D).
                let root = 1;
                for (let i = 0; i < degree; i++) {
                    // Multiply the current product by (x - r^i)
                    for (let j = 0; j < result.length; j++) {
                        result[j] = QrCode.reedSolomonMultiply(result[j], root);
                        if (j + 1 < result.length)
                            result[j] ^= result[j + 1];
                    }
                    root = QrCode.reedSolomonMultiply(root, 0x02);
                }
                return result;
            }
            // Returns the Reed-Solomon error correction codeword for the given data and divisor polynomials.
            static reedSolomonComputeRemainder(data, divisor) {
                let result = divisor.map(_ => 0);
                for (const b of data) { // Polynomial division
                    const factor = b ^ result.shift();
                    result.push(0);
                    divisor.forEach((coef, i) => result[i] ^= QrCode.reedSolomonMultiply(coef, factor));
                }
                return result;
            }
            // Returns the product of the two given field elements modulo GF(2^8/0x11D). The arguments and result
            // are unsigned 8-bit integers. This could be implemented as a lookup table of 256*256 entries of uint8.
            static reedSolomonMultiply(x, y) {
                if (x >>> 8 != 0 || y >>> 8 != 0)
                    throw new RangeError("Byte out of range");
                // Russian peasant multiplication
                let z = 0;
                for (let i = 7; i >= 0; i--) {
                    z = (z << 1) ^ ((z >>> 7) * 0x11D);
                    z ^= ((y >>> i) & 1) * x;
                }
                assert(z >>> 8 == 0);
                return z;
            }
            // Can only be called immediately after a light run is added, and
            // returns either 0, 1, or 2. A helper function for getPenaltyScore().
            finderPenaltyCountPatterns(runHistory) {
                const n = runHistory[1];
                assert(n <= this.size * 3);
                const core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
                return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0)
                    + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
            }
            // Must be called at the end of a line (row or column) of modules. A helper function for getPenaltyScore().
            finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
                if (currentRunColor) { // Terminate dark run
                    this.finderPenaltyAddHistory(currentRunLength, runHistory);
                    currentRunLength = 0;
                }
                currentRunLength += this.size; // Add light border to final run
                this.finderPenaltyAddHistory(currentRunLength, runHistory);
                return this.finderPenaltyCountPatterns(runHistory);
            }
            // Pushes the given value to the front and drops the last value. A helper function for getPenaltyScore().
            finderPenaltyAddHistory(currentRunLength, runHistory) {
                if (runHistory[0] == 0)
                    currentRunLength += this.size; // Add light border to initial run
                runHistory.pop();
                runHistory.unshift(currentRunLength);
            }
        }
        /*-- Constants and tables --*/
        // The minimum version number supported in the QR Code Model 2 standard.
        QrCode.MIN_VERSION = 1;
        // The maximum version number supported in the QR Code Model 2 standard.
        QrCode.MAX_VERSION = 40;
        // For use in getPenaltyScore(), when evaluating which mask is best.
        QrCode.PENALTY_N1 = 3;
        QrCode.PENALTY_N2 = 3;
        QrCode.PENALTY_N3 = 40;
        QrCode.PENALTY_N4 = 10;
        QrCode.ECC_CODEWORDS_PER_BLOCK = [
            // Version: (note that index 0 is for padding, and is set to an illegal value)
            //0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
            [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Low
            [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // Medium
            [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Quartile
            [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // High
        ];
        QrCode.NUM_ERROR_CORRECTION_BLOCKS = [
            // Version: (note that index 0 is for padding, and is set to an illegal value)
            //0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
            [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // Low
            [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // Medium
            [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Quartile
            [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // High
        ];
        qrcodegen.QrCode = QrCode;
        // Appends the given number of low-order bits of the given value
        // to the given buffer. Requires 0 <= len <= 31 and 0 <= val < 2^len.
        function appendBits(val, len, bb) {
            if (len < 0 || len > 31 || val >>> len != 0)
                throw new RangeError("Value out of range");
            for (let i = len - 1; i >= 0; i--) // Append bit by bit
                bb.push((val >>> i) & 1);
        }
        // Returns true iff the i'th bit of x is set to 1.
        function getBit(x, i) {
            return ((x >>> i) & 1) != 0;
        }
        // Throws an exception if the given condition is false.
        function assert(cond) {
            if (!cond)
                throw new Error("Assertion error");
        }
        /*---- Data segment class ----*/
        /*
         * A segment of character/binary/control data in a QR Code symbol.
         * Instances of this class are immutable.
         * The mid-level way to create a segment is to take the payload data
         * and call a static factory function such as QrSegment.makeNumeric().
         * The low-level way to create a segment is to custom-make the bit buffer
         * and call the QrSegment() constructor with appropriate values.
         * This segment class imposes no length restrictions, but QR Codes have restrictions.
         * Even in the most favorable conditions, a QR Code can only hold 7089 characters of data.
         * Any segment longer than this is meaningless for the purpose of generating QR Codes.
         */
        class QrSegment {
            /*-- Static factory functions (mid level) --*/
            // Returns a segment representing the given binary data encoded in
            // byte mode. All input byte arrays are acceptable. Any text string
            // can be converted to UTF-8 bytes and encoded as a byte mode segment.
            static makeBytes(data) {
                let bb = [];
                for (const b of data)
                    appendBits(b, 8, bb);
                return new QrSegment(QrSegment.Mode.BYTE, data.length, bb);
            }
            // Returns a segment representing the given string of decimal digits encoded in numeric mode.
            static makeNumeric(digits) {
                if (!QrSegment.isNumeric(digits))
                    throw new RangeError("String contains non-numeric characters");
                let bb = [];
                for (let i = 0; i < digits.length;) { // Consume up to 3 digits per iteration
                    const n = Math.min(digits.length - i, 3);
                    appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
                    i += n;
                }
                return new QrSegment(QrSegment.Mode.NUMERIC, digits.length, bb);
            }
            // Returns a segment representing the given text string encoded in alphanumeric mode.
            // The characters allowed are: 0 to 9, A to Z (uppercase only), space,
            // dollar, percent, asterisk, plus, hyphen, period, slash, colon.
            static makeAlphanumeric(text) {
                if (!QrSegment.isAlphanumeric(text))
                    throw new RangeError("String contains unencodable characters in alphanumeric mode");
                let bb = [];
                let i;
                for (i = 0; i + 2 <= text.length; i += 2) { // Process groups of 2
                    let temp = QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
                    temp += QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
                    appendBits(temp, 11, bb);
                }
                if (i < text.length) // 1 character remaining
                    appendBits(QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
                return new QrSegment(QrSegment.Mode.ALPHANUMERIC, text.length, bb);
            }
            // Returns a new mutable list of zero or more segments to represent the given Unicode text string.
            // The result may use various segment modes and switch modes to optimize the length of the bit stream.
            static makeSegments(text) {
                // Select the most efficient segment encoding automatically
                if (text == "")
                    return [];
                else if (QrSegment.isNumeric(text))
                    return [QrSegment.makeNumeric(text)];
                else if (QrSegment.isAlphanumeric(text))
                    return [QrSegment.makeAlphanumeric(text)];
                else
                    return [QrSegment.makeBytes(QrSegment.toUtf8ByteArray(text))];
            }
            // Returns a segment representing an Extended Channel Interpretation
            // (ECI) designator with the given assignment value.
            static makeEci(assignVal) {
                let bb = [];
                if (assignVal < 0)
                    throw new RangeError("ECI assignment value out of range");
                else if (assignVal < (1 << 7))
                    appendBits(assignVal, 8, bb);
                else if (assignVal < (1 << 14)) {
                    appendBits(0b10, 2, bb);
                    appendBits(assignVal, 14, bb);
                }
                else if (assignVal < 1000000) {
                    appendBits(0b110, 3, bb);
                    appendBits(assignVal, 21, bb);
                }
                else
                    throw new RangeError("ECI assignment value out of range");
                return new QrSegment(QrSegment.Mode.ECI, 0, bb);
            }
            // Tests whether the given string can be encoded as a segment in numeric mode.
            // A string is encodable iff each character is in the range 0 to 9.
            static isNumeric(text) {
                return QrSegment.NUMERIC_REGEX.test(text);
            }
            // Tests whether the given string can be encoded as a segment in alphanumeric mode.
            // A string is encodable iff each character is in the following set: 0 to 9, A to Z
            // (uppercase only), space, dollar, percent, asterisk, plus, hyphen, period, slash, colon.
            static isAlphanumeric(text) {
                return QrSegment.ALPHANUMERIC_REGEX.test(text);
            }
            /*-- Constructor (low level) and fields --*/
            // Creates a new QR Code segment with the given attributes and data.
            // The character count (numChars) must agree with the mode and the bit buffer length,
            // but the constraint isn't checked. The given bit buffer is cloned and stored.
            constructor(
            // The mode indicator of this segment.
            mode,
            // The length of this segment's unencoded data. Measured in characters for
            // numeric/alphanumeric/kanji mode, bytes for byte mode, and 0 for ECI mode.
            // Always zero or positive. Not the same as the data's bit length.
            numChars,
            // The data bits of this segment. Accessed through getData().
            bitData) {
                this.mode = mode;
                this.numChars = numChars;
                this.bitData = bitData;
                if (numChars < 0)
                    throw new RangeError("Invalid argument");
                this.bitData = bitData.slice(); // Make defensive copy
            }
            /*-- Methods --*/
            // Returns a new copy of the data bits of this segment.
            getData() {
                return this.bitData.slice(); // Make defensive copy
            }
            // (Package-private) Calculates and returns the number of bits needed to encode the given segments at
            // the given version. The result is infinity if a segment has too many characters to fit its length field.
            static getTotalBits(segs, version) {
                let result = 0;
                for (const seg of segs) {
                    const ccbits = seg.mode.numCharCountBits(version);
                    if (seg.numChars >= (1 << ccbits))
                        return Infinity; // The segment's length doesn't fit the field's bit width
                    result += 4 + ccbits + seg.bitData.length;
                }
                return result;
            }
            // Returns a new array of bytes representing the given string encoded in UTF-8.
            static toUtf8ByteArray(str) {
                str = encodeURI(str);
                let result = [];
                for (let i = 0; i < str.length; i++) {
                    if (str.charAt(i) != "%")
                        result.push(str.charCodeAt(i));
                    else {
                        result.push(parseInt(str.substring(i + 1, i + 3), 16));
                        i += 2;
                    }
                }
                return result;
            }
        }
        /*-- Constants --*/
        // Describes precisely all strings that are encodable in numeric mode.
        QrSegment.NUMERIC_REGEX = /^[0-9]*$/;
        // Describes precisely all strings that are encodable in alphanumeric mode.
        QrSegment.ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
        // The set of all legal characters in alphanumeric mode,
        // where each character value maps to the index in the string.
        QrSegment.ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
        qrcodegen.QrSegment = QrSegment;
    })(qrcodegen || (qrcodegen = {}));
    /*---- Public helper enumeration ----*/
    (function (qrcodegen) {
        var QrCode;
        (function (QrCode) {
            /*
             * The error correction level in a QR Code symbol. Immutable.
             */
            class Ecc {
                /*-- Constructor and fields --*/
                constructor(
                // In the range 0 to 3 (unsigned 2-bit integer).
                ordinal,
                // (Package-private) In the range 0 to 3 (unsigned 2-bit integer).
                formatBits) {
                    this.ordinal = ordinal;
                    this.formatBits = formatBits;
                }
            }
            /*-- Constants --*/
            Ecc.LOW = new Ecc(0, 1); // The QR Code can tolerate about  7% erroneous codewords
            Ecc.MEDIUM = new Ecc(1, 0); // The QR Code can tolerate about 15% erroneous codewords
            Ecc.QUARTILE = new Ecc(2, 3); // The QR Code can tolerate about 25% erroneous codewords
            Ecc.HIGH = new Ecc(3, 2); // The QR Code can tolerate about 30% erroneous codewords
            QrCode.Ecc = Ecc;
        })(QrCode = qrcodegen.QrCode || (qrcodegen.QrCode = {}));
    })(qrcodegen || (qrcodegen = {}));
    /*---- Public helper enumeration ----*/
    (function (qrcodegen) {
        var QrSegment;
        (function (QrSegment) {
            /*
             * Describes how a segment's data bits are interpreted. Immutable.
             */
            class Mode {
                /*-- Constructor and fields --*/
                constructor(
                // The mode indicator bits, which is a uint4 value (range 0 to 15).
                modeBits,
                // Number of character count bits for three different version ranges.
                numBitsCharCount) {
                    this.modeBits = modeBits;
                    this.numBitsCharCount = numBitsCharCount;
                }
                /*-- Method --*/
                // (Package-private) Returns the bit width of the character count field for a segment in
                // this mode in a QR Code at the given version number. The result is in the range [0, 16].
                numCharCountBits(ver) {
                    return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
                }
            }
            /*-- Constants --*/
            Mode.NUMERIC = new Mode(0x1, [10, 12, 14]);
            Mode.ALPHANUMERIC = new Mode(0x2, [9, 11, 13]);
            Mode.BYTE = new Mode(0x4, [8, 16, 16]);
            Mode.KANJI = new Mode(0x8, [8, 10, 12]);
            Mode.ECI = new Mode(0x7, [0, 0, 0]);
            QrSegment.Mode = Mode;
        })(QrSegment = qrcodegen.QrSegment || (qrcodegen.QrSegment = {}));
    })(qrcodegen || (qrcodegen = {}));



    function loginQrSvg(url) {
      const qr = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM)
      const size = qr.size + 8
      const cells = []
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (qr.getModule(x, y)) cells.push(`M${x + 4},${y + 4}h1v1h-1z`)
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${size}v${size}H0z"/><path fill="#000" d="${cells.join('')}"/></svg>`
    }


    const NS = 'remoteAccess'

    const zh = {
      tab: '远行之钥',
      title: '远行之钥',
      subtitle: '管理 DSH Web 的启动 Token 与固定访问地址，避免重启后已收藏的登录链接失效。',
      guideTitle: '三步连接手机 / 平板',
      guideToken: '1 · 选择「固定 Token」即可自动生成并立即启用；需要自定义时在下方填写后保存。所有设备使用同一个 DSH 登录凭据。',
      guideUrl: '2 · 保持电脑与远端设备的 Tailscale 在线，填写电脑启动器显示的访问地址并保存。',
      guideLink: '3 · 显示登录二维码，用手机 / 平板扫码打开并收藏。Token 不是 Tailscale 的登录密钥。',
      urlUnsaved: '地址尚未保存，请先保存后显示登录二维码。',
      modeTitle: '认证模式',
      modeHint: '随机 Token 每次启动重新生成；固定 Token 保存在本机凭据库中，重启后继续有效。',
      ephemeral: '随机 Token',
      ephemeralHint: '保持 DSH 默认行为，每次启动生成新的随机 Token。',
      persistent: '固定 Token',
      persistentHint: '使用持久化的 Token，重启后收藏的登录链接仍可用。',
      environment: '环境变量接管',
      environmentHint: '检测到 DSH_WEB_TOKEN，Token 由环境变量决定；界面只能查看，不能修改。',
      active: '当前',
      tokenTitle: 'Token 管理',
      tokenHint: '自动生成使用 32 字节（256 位）密码学安全随机数；自定义 Token 需 32–256 个 URL 安全字符。',
      tokenPlaceholder: '输入自定义 Token，或点击生成',
      generate: '生成安全 Token',
      save: '保存并启用',
      revoke: '撤销固定 Token',
      confirmRevoke: '确认撤销',
      show: '显示',
      hide: '隐藏',
      copyToken: '复制 Token',
      tokenMissing: '尚未配置固定 Token',
      tokenConfigured: '已配置固定 Token',
      urlTitle: '远程访问地址',
      urlHint: '填写启动器显示的 Tailscale Serve HTTPS 地址，例如 https://device.tailnet.ts.net/。此处只保存地址，不启动网络服务。',
      urlPlaceholder: 'https://device.tailnet.ts.net/',
      saveUrl: '保存地址',
      showQr: '显示登录二维码',
      hideQr: '隐藏二维码',
      qrAlt: '远程登录二维码',
      scanQr: '使用手机 / 平板扫描二维码，在浏览器中打开连接。',
      statusTitle: '连接状态',
      statusMode: '认证模式',
      statusToken: 'Token 配置',
      statusWeb: 'Web 服务',
      statusBase: '远程地址',
      statusEffective: '配置状态',
      yes: '是',
      no: '否',
      running: '运行中',
      notSet: '未设置',
      effective: '已生效',
      notEffective: '未生效',
      copyWarning: '二维码包含登录 Token，请勿公开分享或截图传播。',
      copied: '已复制',
      copyFailed: '复制失败',
      saved: '已保存',
      generated: '已生成新 Token，请点击「保存并启用」',
      revoked: '已撤销固定 Token，恢复随机模式',
      loading: '读取中…',
      failed: '读取失败：{message}',
      operationFailed: '操作失败：{message}',
      refresh: '刷新',
      hostHint: '若提示 404/405，请确认插件已启用并在插件页查看启动异常。',
    }

    const en = {
      tab: 'Wayfarer Key',
      title: 'Wayfarer Key',
      subtitle: 'Manage the DSH Web launch token and a stable public URL so bookmarked sign-in links survive restarts.',
      guideTitle: 'Connect your phone / tablet in three steps',
      guideToken: '1 · Select Persistent token to generate and enable one immediately, or enter a custom token below and save. All devices use the same DSH credential.',
      guideUrl: '2 · Connect both devices to Tailscale. Save the computer URL shown by your launcher.',
      guideLink: '3 · Show the sign-in QR code, scan it on your phone / tablet and bookmark the page. This is a DSH token, not a Tailscale auth key.',
      urlUnsaved: 'Save the edited URL before showing the sign-in QR code.',
      modeTitle: 'Authentication mode',
      modeHint: 'An ephemeral token is regenerated on every start; a persistent token is stored in this machine’s credential store.',
      ephemeral: 'Ephemeral token',
      ephemeralHint: 'Keep the DSH default: a new random token on every start.',
      persistent: 'Persistent token',
      persistentHint: 'Keep one token across restarts so bookmarked links keep working.',
      environment: 'Managed by environment',
      environmentHint: 'DSH_WEB_TOKEN is set, so the environment owns the token; it can be viewed but not changed here.',
      active: 'Active',
      tokenTitle: 'Token management',
      tokenHint: 'Generated tokens use 32 bytes (256 bits) of cryptographic randomness; custom tokens need 32–256 URL-safe characters.',
      tokenPlaceholder: 'Enter a custom token or generate one',
      generate: 'Generate secure token',
      save: 'Save and enable',
      revoke: 'Revoke persistent token',
      confirmRevoke: 'Confirm revoke',
      show: 'Show',
      hide: 'Hide',
      copyToken: 'Copy token',
      tokenMissing: 'No persistent token configured',
      tokenConfigured: 'Persistent token configured',
      urlTitle: 'Remote access URL',
      urlHint: 'Enter the HTTPS base URL published by Tailscale or another reverse proxy. DSH does not change or enable proxy configuration.',
      urlPlaceholder: 'https://device.tailnet.ts.net/',
      saveUrl: 'Save URL',
      showQr: 'Show sign-in QR code',
      hideQr: 'Hide QR code',
      qrAlt: 'Remote sign-in QR code',
      scanQr: 'Scan with your phone / tablet and open the connection in a browser.',
      statusTitle: 'Connection status',
      statusMode: 'Authentication mode',
      statusToken: 'Token',
      statusWeb: 'Web service',
      statusBase: 'Remote URL',
      statusEffective: 'Configuration',
      yes: 'Yes',
      no: 'No',
      running: 'Running',
      notSet: 'Not set',
      effective: 'Active',
      notEffective: 'Not active',
      copyWarning: 'The QR code contains your sign-in token. Keep it private and do not share screenshots.',
      copied: 'Copied',
      copyFailed: 'Copy failed',
      saved: 'Saved',
      generated: 'Token generated. Click “Save and enable”.',
      revoked: 'Persistent token revoked; back to ephemeral mode.',
      loading: 'Loading…',
      failed: 'Load failed: {message}',
      operationFailed: 'Operation failed: {message}',
      refresh: 'Refresh',
      hostHint: 'On 404/405, confirm the plugin is enabled and check its startup diagnostics.',
    }

    const STYLE = [
      '.ra-root{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);}',
      '.ra-head{display:flex;align-items:flex-start;gap:12px;}',
      '.ra-globe{width:40px;height:40px;flex:none;border-radius:12px;display:grid;place-items:center;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-brand-primary);}',
      '.ra-headText{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1;}',
      '.ra-title{margin:0;font-size:16px;line-height:24px;font-weight:600;letter-spacing:.2px;}',
      '.ra-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}',
      '.ra-card{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);}',
      '.ra-cardHead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}',
      '.ra-cardTitle{margin:0;font-size:13px;line-height:20px;font-weight:600;}',
      '.ra-hint{margin:0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);}',
      '.ra-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
      '.ra-mode{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:12px;cursor:pointer;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);transition:border-color .15s,background .15s;}',
      '.ra-mode:hover{border-color:var(--dsw-alias-border-l2);}',
      '.ra-mode.on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);}',
      '.ra-mode input{margin:3px 0 0;}',
      '.ra-modeBody{display:flex;flex-direction:column;gap:3px;min-width:0;}',
      '.ra-modeName{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;}',
      '.ra-chip{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:999px;font-size:10px;',
      'border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);}',
      '.ra-chip.on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}',
      '.ra-field{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
      '.ra-input{flex:1;min-width:200px;height:32px;padding:0 10px;border-radius:9px;font:inherit;font-size:12px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;outline:0;}',
      '.ra-input:focus{border-color:var(--dsw-alias-brand-primary);}',
      '.ra-input.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}',
      '.ra-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;font:inherit;',
      'font-size:12px;cursor:pointer;transition:border-color .15s,color .15s,background .15s;}',
      '.ra-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}',
      '.ra-btn:disabled{opacity:.45;cursor:default;}',
      '.ra-btn.primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);',
      'background:var(--dsw-alias-bg-layer-2);}',
      '.ra-btn.danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}',
      '.ra-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px 24px;margin:0;padding-top:4px;}',
      '.ra-stat{display:flex;flex-direction:column;gap:6px;min-width:0;}',
      '.ra-stat dt{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);}',
      '.ra-stat dd{margin:0;font-size:13px;line-height:20px;font-weight:500;overflow-wrap:anywhere;}',
      '.ra-stat.address{grid-column:1/-1;border-top:1px solid var(--dsw-alias-border-l1);padding-top:14px;}',
      '.ra-stat.address dd{font-size:12px;font-weight:400;}',
      '.ra-ok{color:var(--dsw-alias-state-success-primary);}',
      '.ra-warn{color:var(--dsw-alias-state-warn-primary);}',
      '.ra-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);}',
      '.ra-notice{margin:0;font-size:11px;line-height:17px;color:var(--dsw-alias-brand-primary);}',
      '.ra-warnLine{display:flex;align-items:flex-start;gap:6px;font-size:11px;line-height:17px;color:var(--dsw-alias-state-warn-primary);}',
      '.ra-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.ra-spacer{flex:1;}',
      '@media (max-width:720px){.ra-modes{grid-template-columns:1fr;}.ra-field .ra-btn{width:100%;}}',
      '@media (max-width:540px){.ra-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;}}',
    ].join('')

    // The UI-primitives artwork named 'globe-outline', redrawn at 20px so the
    // plugin matches the native icon set instead of introducing a new one.
    function icon() {
      return h('svg', {
        width: 20, height: 20, viewBox: '0 0 16 16', fill: 'none',
        'aria-hidden': true, focusable: false,
      },
      h('path', {
        d: 'M7.99986 14.0887C11.3626 14.0887 14.0886 11.3627 14.0886 7.99998C14.0886 4.63727 11.3626 1.91125 7.99986 1.91125C4.63715 1.91125 1.91113 4.63727 1.91113 7.99998C1.91113 11.3627 4.63715 14.0887 7.99986 14.0887Z',
        stroke: 'currentColor', strokeWidth: 1.45,
      }),
      h('path', { d: 'M2.34619 8H13.6538', stroke: 'currentColor', strokeWidth: 1.45, strokeLinecap: 'square' }),
      h('path', {
        d: 'M7.99976 14.0889C9.23509 14.0889 10.1743 11.3629 10.1743 8.00006C10.1743 4.63739 9.23509 1.91138 7.99976 1.91138',
        stroke: 'currentColor', strokeWidth: 1.45,
      }),
      h('path', {
        d: 'M7.99973 14.0889C6.76445 14.0889 5.8252 11.3629 5.8252 8.00006C5.8252 4.63739 6.76445 1.91138 7.99973 1.91138',
        stroke: 'currentColor', strokeWidth: 1.45,
      }))
    }

    async function copyText(value) {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        return
      }
      const area = document.createElement('textarea')
      area.value = value
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      if (!ok) throw new Error('copy rejected')
    }

    function errorText(cause) {
      return cause && cause.message ? cause.message : String(cause)
    }

    function RemoteAccessTab(props) {
      const t = props.t
      const [state, setState] = useState({ status: 'loading', data: null, error: null })
      const [tokenDraft, setTokenDraft] = useState('')
      const [baseDraft, setBaseDraft] = useState('')
      const [showToken, setShowToken] = useState(false)
      const [qrImage, setQrImage] = useState('')
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState('')
      const [confirmRevoke, setConfirmRevoke] = useState(false)
      const timer = useRef(null)

      const faceRef = useRef(props)
      faceRef.current = props

      const flash = useCallback(function (text) {
        setNotice(text)
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(function () { setNotice('') }, 3200)
      }, [])

      const call = useCallback(function (endpoint, payload) {
        if (['save', 'revoke', 'status'].includes(endpoint)) setQrImage('')
        return faceRef.current.remoteAccessCall(endpoint, payload || {})
      }, [])

      const load = useCallback(function () {
        setState(function (current) { return { status: 'loading', data: current.data, error: null } })
        return call('status').then(function (data) {
          setState({ status: 'idle', data: data, error: null })
          setBaseDraft(data && data.baseUrl ? data.baseUrl : '')
          setTokenDraft('')
          setShowToken(false)
        }, function (cause) {
          setState({ status: 'error', data: null, error: errorText(cause) })
        })
      }, [call])

      useEffect(function () { void load() }, [load])
      useEffect(function () {
        function hideQrOnBackground() { if (document.hidden) setQrImage('') }
        document.addEventListener('visibilitychange', hideQrOnBackground)
        return function () { document.removeEventListener('visibilitychange', hideQrOnBackground) }
      }, [])
      useEffect(function () {
        return function () { if (timer.current !== null) clearTimeout(timer.current) }
      }, [])

      const data = state.data
      const mode = data ? data.mode : 'ephemeral'
      const envMode = mode === 'environment'
      const fixed = mode === 'persistent'

      async function refresh(next) {
        if (next && next.mode) setState({ status: 'idle', data: next, error: null })
        else await load()
      }

      async function saveMode(target) {
        if (busy) return
        setBusy(true)
        try {
          const next = await call('save', {
            mode: target,
            token: tokenDraft.trim() === '' ? undefined : tokenDraft.trim(),
          })
          await refresh(next)
          setTokenDraft('')
          setShowToken(false)
          flash(target === 'persistent' ? t('saved') : t('revoked'))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      async function generate() {
        if (busy) return
        setBusy(true)
        try {
          const result = await call('generate')
          setTokenDraft(result.token)
          setShowToken(true)
          flash(t('generated'))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      async function reveal() {
        if (showToken) { setShowToken(false); setTokenDraft(''); return }
        if (busy) return
        setBusy(true)
        try {
          const result = await call('reveal')
          setTokenDraft(result.token)
          setShowToken(true)
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      async function toggleQr() {
        if (busy) return
        if (qrImage) { setQrImage(''); return }
        setBusy(true)
        try {
          const result = await call('link')
          setQrImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(loginQrSvg(result.url)))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally { setBusy(false) }
      }

      async function copy() {
        try {
          const result = await call('reveal')
          await copyText(result.token)
          flash(t('copied'))
        } catch (cause) {
          flash(t('copyFailed') + ' · ' + errorText(cause))
        }
      }

      async function saveUrl() {
        if (busy) return
        setBusy(true)
        try {
          const next = await call('save', { baseUrl: baseDraft })
          await refresh(next)
          setBaseDraft(next.baseUrl)
          flash(t('saved'))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      async function revoke() {
        if (busy || !confirmRevoke) { setConfirmRevoke(true); return }
        setBusy(true)
        try {
          const next = await call('revoke')
          await refresh(next)
          setTokenDraft('')
          setShowToken(false)
          setConfirmRevoke(false)
          flash(t('revoked'))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      const urlDirty = !!data && baseDraft.trim() !== data.baseUrl
      const modeLabel = mode === 'environment' ? t('environment') : fixed ? t('persistent') : t('ephemeral')

      return h('section', { className: 'ra-root', 'aria-label': t('title') },
        h('style', null, STYLE),
        h('header', { className: 'ra-head' },
          h('span', { className: 'ra-globe' }, icon()),
          h('div', { className: 'ra-headText' },
            h('h2', { className: 'ra-title' }, t('title')),
            h('p', { className: 'ra-sub' }, t('subtitle')))),
        state.status === 'error'
          ? h('div', { className: 'ra-card' },
            h('p', { role: 'alert', className: 'ra-error' }, t('failed', { message: state.error })),
            h('p', { className: 'ra-hint' }, t('hostHint')),
            h('div', { className: 'ra-foot' },
              h('button', { className: 'ra-btn', type: 'button', onClick: function () { void load() } }, t('refresh'))))
          : null,
        state.status === 'loading' && !data
          ? h('div', { className: 'ra-card' }, h('p', { className: 'ra-hint' }, t('loading')))
          : null,
        data ? h(React.Fragment, null,
          h('div', { className: 'ra-card' },
            h('h3', { className: 'ra-cardTitle' }, t('guideTitle')),
            h('p', { className: 'ra-hint' }, t('guideToken')),
            h('p', { className: 'ra-hint' }, t('guideUrl')),
            h('p', { className: 'ra-hint' }, t('guideLink'))),
          envMode ? h('div', { className: 'ra-card' },
            h('p', { className: 'ra-cardTitle' }, t('environment')),
            h('p', { className: 'ra-hint' }, t('environmentHint'))) : null,

          h('div', { className: 'ra-card' },
            h('div', { className: 'ra-cardHead' },
              h('h3', { className: 'ra-cardTitle' }, t('modeTitle')),
              h('span', { className: fixed ? 'ra-chip on' : 'ra-chip' }, modeLabel)),
            h('p', { className: 'ra-hint' }, t('modeHint')),
            h('div', { className: 'ra-modes' },
              h('label', { className: mode === 'ephemeral' ? 'ra-mode on' : 'ra-mode' },
                h('input', {
                  type: 'radio', name: 'ra-mode', checked: mode === 'ephemeral', disabled: busy || envMode,
                  onChange: function () { void saveMode('ephemeral') },
                }),
                h('span', { className: 'ra-modeBody' },
                  h('span', { className: 'ra-modeName' }, t('ephemeral'),
                    mode === 'ephemeral' ? h('span', { className: 'ra-chip on' }, t('active')) : null),
                  h('span', { className: 'ra-hint' }, t('ephemeralHint')))),
              h('label', { className: fixed ? 'ra-mode on' : 'ra-mode' },
                h('input', {
                  type: 'radio', name: 'ra-mode', checked: fixed, disabled: busy || envMode,
                  onChange: function () { void saveMode('persistent') },
                }),
                h('span', { className: 'ra-modeBody' },
                  h('span', { className: 'ra-modeName' }, t('persistent'),
                    fixed ? h('span', { className: 'ra-chip on' }, t('active')) : null),
                  h('span', { className: 'ra-hint' }, t('persistentHint')))))),

          h('div', { className: 'ra-card' },
            h('div', { className: 'ra-cardHead' },
              h('h3', { className: 'ra-cardTitle' }, t('tokenTitle')),
              h('span', { className: data.configured ? 'ra-chip on' : 'ra-chip' },
                data.configured ? t('tokenConfigured') : t('tokenMissing'))),
            h('p', { className: 'ra-hint' }, t('tokenHint')),
            data.tokenMasked ? h('p', { className: 'ra-hint mono' }, '•• ' + data.tokenMasked) : null,
            h('div', { className: 'ra-field' },
              h('input', {
                'aria-label': t('tokenTitle'), className: 'ra-input mono', type: showToken ? 'text' : 'password',
                value: tokenDraft,
                placeholder: data.configured && !showToken ? data.tokenMasked : t('tokenPlaceholder'),
                autoComplete: 'off', spellCheck: false, disabled: busy || envMode,
                onChange: function (event) { setTokenDraft(event.target.value) },
              })),
            h('div', { className: 'ra-field' },
              h('button', { className: 'ra-btn', type: 'button', disabled: busy || envMode, onClick: function () { void generate() } }, t('generate')),
              h('button', { className: 'ra-btn primary', type: 'button', disabled: busy || envMode, onClick: function () { void saveMode('persistent') } }, t('save')),
              h('button', { className: 'ra-btn', type: 'button', disabled: busy || envMode, onClick: function () { void reveal() } }, showToken ? t('hide') : t('show')),
              h('button', { className: 'ra-btn', type: 'button', disabled: busy || !data.configured, onClick: function () { void copy('token') } }, t('copyToken')),
              h('span', { className: 'ra-spacer' }),
              h('button', { className: confirmRevoke ? 'ra-btn danger' : 'ra-btn danger', type: 'button', disabled: busy || !data.configured || envMode, onClick: function () { void revoke() } }, confirmRevoke ? t('confirmRevoke') : t('revoke')))),

          h('div', { className: 'ra-card' },
            h('h3', { className: 'ra-cardTitle' }, t('urlTitle')),
            h('p', { className: 'ra-hint' }, t('urlHint')),
            h('div', { className: 'ra-field' },
              h('input', {
                'aria-label': t('urlTitle'), className: 'ra-input mono', type: 'text', value: baseDraft, placeholder: t('urlPlaceholder'),
                spellCheck: false, disabled: busy,
                onChange: function (event) { setQrImage(''); setBaseDraft(event.target.value) },
              }),
              h('button', { className: 'ra-btn', type: 'button', disabled: busy, onClick: function () { void saveUrl() } }, t('saveUrl'))),
            h('div', { className: 'ra-field' },
              h('button', { className: 'ra-btn primary', type: 'button', disabled: busy || urlDirty || !data.baseUrl || !data.configured || mode === 'ephemeral', onClick: function () { void toggleQr() } }, t(qrImage ? 'hideQr' : 'showQr'))),
            qrImage ? h('div', { className: 'ra-qr' },
              h('img', { src: qrImage, alt: t('qrAlt'), width: 256, height: 256, style: { display: 'block', width: '256px', maxWidth: '100%', height: 'auto' } }),
              h('p', { className: 'ra-hint' }, t('scanQr'))) : null,
            urlDirty ? h('p', { className: 'ra-warnLine' }, t('urlUnsaved')) : null,
            h('p', { className: 'ra-warnLine' }, t('copyWarning'))),

          h('div', { className: 'ra-card' },
            h('h3', { className: 'ra-cardTitle' }, t('statusTitle')),
            h('dl', { className: 'ra-grid' },
              stat(t('statusMode'), modeLabel),
              stat(t('statusToken'), data.configured ? t('tokenConfigured') : t('tokenMissing')),
              stat(t('statusWeb'), data.webRunning ? t('running') : t('notSet'), data.webRunning ? 'ok' : 'warn'),
              stat(t('statusEffective'), data.configured || mode === 'environment' ? t('effective') : t('notEffective'),
                data.configured || mode === 'environment' ? 'ok' : 'warn'),
              stat(t('statusBase'), data.baseUrl || t('notSet'), undefined, 'address'))),

          h('div', { className: 'ra-foot' },
            notice ? h('span', { role: 'status', className: 'ra-notice' }, notice) : null,
            h('span', { className: 'ra-spacer' }),
            h('button', { className: 'ra-btn', type: 'button', disabled: busy, onClick: function () { void load() } }, t('refresh'))))
          : null)
    }

    function stat(label, value, tone, variant) {
      return h('div', { className: 'ra-stat' + (variant ? ' ' + variant : '') },
        h('dt', null, label),
        h('dd', { className: tone === 'ok' ? 'ra-ok' : tone === 'warn' ? 'ra-warn' : undefined }, value))
    }

    function apply(ctx) {
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'remote-access: dictionaries')
      const t = ctx.locale.bind(NS)
      const unwrap = function (answer) {
        if (answer && answer.ok === true) return answer.value
        const failure = answer && answer.error ? answer.error : undefined
        throw new Error(failure ? (failure.message || failure.code) : 'remote-access call failed')
      }
      const face = {
        remoteAccessCall: function (endpoint, payload) {
          return ctx.connection.rpc.call('/api', 'remote-access/' + endpoint, payload || {}).then(unwrap)
        },
      }
      ctx.slots.inject('plugins.tab', function () {
        return ctx.slots.register({
          name: 'plugins.tab',
          id: 'remote-access',
          order: 40,
          label: function () { return t('tab') },
          locale: NS,
          inject: function () { return face },
        }, RemoteAccessTab)
      })
    }

    return { inject: ['slots', 'locale', 'connection'], apply: apply }
  },
})
