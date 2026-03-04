'use client'

/**
 * WhatsApp-style notification sounds using Web Audio API
 * No external audio files needed — pure synthesized sounds.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    // Resume if suspended (browsers require user gesture)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume()
    }
    return audioCtx
}

/**
 * Play the "sent" sound — short, crisp ascending pop (like WhatsApp send)
 */
export function playSentSound() {
    try {
        const ctx = getAudioContext()
        const now = ctx.currentTime

        // Oscillator: quick ascending tone
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(800, now)
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08)

        // Gain: short punch envelope
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.12)
    } catch {
        // Silently fail if audio context isn't available
    }
}

/**
 * Play the "received" sound — double-tap descending pop (like WhatsApp receive)
 */
export function playReceivedSound() {
    try {
        const ctx = getAudioContext()
        const now = ctx.currentTime

        // First pop — higher tone
        const osc1 = ctx.createOscillator()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(1100, now)
        osc1.frequency.exponentialRampToValueAtTime(700, now + 0.07)

        const gain1 = ctx.createGain()
        gain1.gain.setValueAtTime(0.15, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.1)

        // Second pop — slightly lower, softer (the "double tap" effect)
        const osc2 = ctx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(900, now + 0.1)
        osc2.frequency.exponentialRampToValueAtTime(600, now + 0.17)

        const gain2 = ctx.createGain()
        gain2.gain.setValueAtTime(0, now)
        gain2.gain.setValueAtTime(0.12, now + 0.1)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(now + 0.1)
        osc2.stop(now + 0.2)
    } catch {
        // Silently fail
    }
}
