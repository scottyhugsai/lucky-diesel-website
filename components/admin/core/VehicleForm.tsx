'use client';

import { LoaderCircle, ScanLine, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { decodeVin, saveVehicle } from '@/app/admin/customers/actions';
import { buttonClass, fieldClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { ActionForm, PendingButton } from './ActionForm';

type Vehicle = Tables<'vehicles'>;
type Fields = Record<'vin' | 'year' | 'make' | 'model' | 'platform' | 'generation' | 'engine_code' | 'transmission' | 'mileage' | 'nickname' | 'color', string>;

const PLATFORMS = [['', 'Not set'], ['duramax', 'Duramax'], ['powerstroke', 'Powerstroke'], ['cummins', 'Cummins'], ['other', 'Other / gas']] as const;
const small = `${fieldClass} h-10 text-sm`;

function initial(vehicle?: Vehicle): Fields {
  const s = (value: string | number | null | undefined) => (value === null || value === undefined ? '' : String(value));
  return {
    vin: s(vehicle?.vin), year: s(vehicle?.year), make: s(vehicle?.make), model: s(vehicle?.model), platform: s(vehicle?.platform),
    generation: s(vehicle?.generation), engine_code: s(vehicle?.engine_code), transmission: s(vehicle?.transmission),
    mileage: s(vehicle?.mileage), nickname: s(vehicle?.nickname), color: s(vehicle?.color),
  };
}

export function VehicleForm({ customerId, vehicle, onDone }: { customerId: string; vehicle?: Vehicle; onDone?: () => void }) {
  const [fields, setFields] = useState<Fields>(() => initial(vehicle));
  const [decoding, startDecode] = useTransition();
  const [decodeMessage, setDecodeMessage] = useState<{ tone: 'good' | 'bad' | 'warn'; text: string } | null>(null);

  const set = (name: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFields((prev) => ({ ...prev, [name]: event.target.value }));

  function runDecode() {
    setDecodeMessage(null);
    startDecode(async () => {
      try {
        const result = await decodeVin(fields.vin);
        if (result.error || !result.data) {
          setDecodeMessage({ tone: 'bad', text: result.error ?? 'Decode failed.' });
          return;
        }
        const d = result.data;
        setFields((prev) => ({
          ...prev,
          vin: prev.vin.toUpperCase().trim(),
          year: d.year ? String(d.year) : prev.year,
          make: d.make ?? prev.make,
          model: d.model ?? prev.model,
          engine_code: d.engineCode ?? prev.engine_code,
          transmission: d.transmission ?? prev.transmission,
          platform: d.platform,
          generation: d.generation ?? prev.generation,
        }));
        const summary = `Decoded: ${[d.year, d.make, d.model, d.engineCode].filter(Boolean).join(' ')}${d.fuel ? ` · ${d.fuel}` : ''}. Review, then save.`;
        setDecodeMessage({ tone: d.warning ? 'warn' : 'good', text: d.warning ? `${summary} ${d.warning}` : summary });
      } catch {
        setDecodeMessage({ tone: 'bad', text: 'Couldn’t reach the VIN decoder. Enter the details by hand.' });
      }
    });
  }

  const input = (name: keyof Fields, label: string, className = '', extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={className}>
      <span className="mb-1 block text-xs font-semibold text-steel">{label}</span>
      <input name={name} value={fields[name]} onChange={set(name)} className={small} {...extra} />
    </label>
  );

  return (
    <ActionForm action={saveVehicle} onSuccess={onDone} resetOnSuccess={false} className="grid gap-3 rounded-sm border border-clover/30 bg-carbon p-3 sm:grid-cols-6" aria-label={vehicle ? 'Edit truck' : 'Add truck'}>
      <input type="hidden" name="customer_id" value={customerId} />
      {vehicle && <input type="hidden" name="vehicle_id" value={vehicle.id} />}
      <div className="sm:col-span-6">
        <span className="mb-1 block text-xs font-semibold text-steel">VIN</span>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor={`vin-${vehicle?.id ?? 'new'}`}>VIN</label>
          <input id={`vin-${vehicle?.id ?? 'new'}`} name="vin" value={fields.vin} onChange={set('vin')} maxLength={17} autoCapitalize="characters" spellCheck={false} className={`${small} min-w-0 flex-1 font-mono uppercase`} />
          <button type="button" onClick={runDecode} disabled={decoding || fields.vin.trim().length !== 17} className={`${buttonClass('secondary', 'sm')} !h-10 shrink-0`}>
            {decoding ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ScanLine className="size-4" aria-hidden="true" />}
            Decode
          </button>
        </div>
        {decodeMessage && (
          <p role={decodeMessage.tone === 'bad' ? 'alert' : 'status'} className={`mt-1.5 text-xs font-semibold ${decodeMessage.tone === 'bad' ? 'text-danger' : decodeMessage.tone === 'warn' ? 'text-amber-300' : 'text-clover'}`}>
            {decodeMessage.text}
          </p>
        )}
      </div>
      {input('year', 'Year', 'sm:col-span-1', { inputMode: 'numeric' })}
      {input('make', 'Make', 'sm:col-span-2')}
      {input('model', 'Model', 'sm:col-span-3')}
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold text-steel">Platform</span>
        <select name="platform" value={fields.platform} onChange={set('platform')} className={small}>
          {PLATFORMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {input('generation', 'Generation', 'sm:col-span-2')}
      {input('engine_code', 'Engine', 'sm:col-span-2')}
      {input('transmission', 'Transmission', 'sm:col-span-2')}
      {input('mileage', 'Mileage', 'sm:col-span-2', { inputMode: 'numeric' })}
      {input('nickname', 'Nickname', 'sm:col-span-1')}
      {input('color', 'Color', 'sm:col-span-1')}
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-6">
        {onDone && <button type="button" onClick={onDone} className={buttonClass('ghost', 'sm')}><X className="size-4" aria-hidden="true" /> Cancel</button>}
        <PendingButton size="sm">{vehicle ? 'Save truck' : 'Add truck'}</PendingButton>
      </div>
    </ActionForm>
  );
}
