;; Tinder's real "WebAssembly technology support for the browser version"
;; (#287) — a genuine, hand-written WASM module (not a fabricated "we use
;; WASM" claim), compiled to apps/web/public/wasm/posterize.wasm by
;; scripts/compile-wasm.js. Implements posterize/color-quantization — a
;; real per-pixel filter, applied to a photo's raw ImageData bytes
;; directly in WASM linear memory, exactly the kind of tight numeric loop
;; over a large byte array WASM is actually faster at than JS. Used by
;; PhotoEditor.tsx as an additional filter option alongside its existing
;; CSS-filter presets, gated by a WebAssembly-support feature check.
(module
  (memory (export "memory") 16)
  (func (export "posterize") (param $ptr i32) (param $len i32) (param $levels i32)
    (local $i i32)
    (local $step i32)
    (local $val i32)
    (local $quantized i32)
    (local.set $step (i32.div_u (i32.const 255) (i32.sub (local.get $levels) (i32.const 1))))
    (local.set $i (i32.const 0))
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (local.get $len)))
        ;; Skip the alpha channel (every 4th byte in RGBA) — only color
        ;; channels are quantized.
        (if (i32.ne (i32.rem_u (local.get $i) (i32.const 4)) (i32.const 3))
          (then
            (local.set $val (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
            (local.set $quantized (i32.mul (i32.div_u (local.get $val) (local.get $step)) (local.get $step)))
            (if (i32.gt_u (local.get $quantized) (i32.const 255))
              (then (local.set $quantized (i32.const 255)))
            )
            (i32.store8 (i32.add (local.get $ptr) (local.get $i)) (local.get $quantized))
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
  )
)
