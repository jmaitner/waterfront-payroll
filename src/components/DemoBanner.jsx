// Always-visible notice so no one mistakes the demo for the real product.
// Data is local to the device and resets — not a system of record yet.
export default function DemoBanner() {
  return (
    <div className="bg-amber-400 px-3 py-1.5 text-center text-[11px] font-bold leading-tight text-navy">
      ⚠ DEMO — sample data, saved only on this device. Not for live payroll.
    </div>
  )
}
