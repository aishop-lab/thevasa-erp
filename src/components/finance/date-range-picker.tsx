'use client'

import { useState, useCallback } from 'react'
import { CalendarIcon, ChevronDown, ArrowLeftRight } from 'lucide-react'
import { format } from 'date-fns'
import { type DateRange as RdpDateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  type DatePreset,
  type Granularity,
  DATE_PRESETS,
  getPresetDateRange,
  getPreviousPeriod,
  autoGranularity,
  formatDateRange,
} from '@/lib/utils/date'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRangePickerValue {
  from: Date
  to: Date
  compareFrom?: Date
  compareTo?: Date
  granularity: Granularity
  preset: DatePreset | 'custom'
}

interface DateRangePickerProps {
  value: DateRangePickerValue
  onChange: (value: DateRangePickerValue) => void
  className?: string
  showComparison?: boolean
  showGranularity?: boolean
}

// ---------------------------------------------------------------------------
// Preset groups for better organization
// ---------------------------------------------------------------------------

const PRESET_GROUPS = [
  {
    label: 'Days',
    presets: ['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days'] as DatePreset[],
  },
  {
    label: 'Weeks',
    presets: ['this_week', 'last_week'] as DatePreset[],
  },
  {
    label: 'Months',
    presets: ['this_month', 'last_month'] as DatePreset[],
  },
  {
    label: 'Quarters & Years',
    presets: ['this_quarter', 'last_quarter', 'this_year', 'last_year'] as DatePreset[],
  },
]

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DateRangePicker({
  value,
  onChange,
  className,
  showComparison = true,
  showGranularity = true,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [compareEnabled, setCompareEnabled] = useState(
    !!(value.compareFrom && value.compareTo)
  )

  const handlePresetClick = useCallback(
    (preset: DatePreset) => {
      const range = getPresetDateRange(preset)
      const gran = autoGranularity(range.from, range.to)
      const prev = compareEnabled ? getPreviousPeriod(range.from, range.to) : undefined

      onChange({
        from: range.from,
        to: range.to,
        compareFrom: prev?.from,
        compareTo: prev?.to,
        granularity: gran,
        preset,
      })
    },
    [onChange, compareEnabled]
  )

  const handleCalendarSelect = useCallback(
    (range: RdpDateRange | undefined) => {
      if (!range?.from) return
      const from = range.from
      const to = range.to ?? range.from
      const gran = autoGranularity(from, to)
      const prev = compareEnabled ? getPreviousPeriod(from, to) : undefined

      onChange({
        from,
        to,
        compareFrom: prev?.from,
        compareTo: prev?.to,
        granularity: gran,
        preset: 'custom',
      })
    },
    [onChange, compareEnabled]
  )

  const handleCompareToggle = useCallback(() => {
    const next = !compareEnabled
    setCompareEnabled(next)
    if (next) {
      const prev = getPreviousPeriod(value.from, value.to)
      onChange({ ...value, compareFrom: prev.from, compareTo: prev.to })
    } else {
      onChange({ ...value, compareFrom: undefined, compareTo: undefined })
    }
  }, [value, onChange, compareEnabled])

  const handleGranularityClick = useCallback(
    (gran: Granularity) => {
      onChange({ ...value, granularity: gran })
    },
    [value, onChange]
  )

  const presetLabel =
    value.preset !== 'custom'
      ? DATE_PRESETS.find((p) => p.value === value.preset)?.label
      : null

  const displayLabel = presetLabel || formatDateRange(value.from, value.to)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 justify-start gap-2 text-left font-normal px-3',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{displayLabel}</span>
          {compareEnabled && (
            <ArrowLeftRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 overflow-hidden"
        align="end"
        sideOffset={8}
      >
        <div className="flex max-h-[calc(100vh-200px)]">
          {/* Presets sidebar */}
          <div className="w-[160px] shrink-0 border-r bg-muted/30 overflow-y-auto">
            {PRESET_GROUPS.map((group) => (
              <div key={group.label} className="p-1.5">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
                {group.presets.map((presetKey) => {
                  const preset = DATE_PRESETS.find((p) => p.value === presetKey)
                  if (!preset) return null
                  const isActive = value.preset === preset.value
                  return (
                    <button
                      key={preset.value}
                      onClick={() => handlePresetClick(preset.value)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-[13px] rounded-md transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-medium'
                      )}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Calendar + controls */}
          <div className="flex flex-col">
            {/* Selected range display */}
            <div className="flex items-center gap-2 border-b px-4 py-2.5 bg-muted/20">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-medium">
                  {format(value.from, 'MMM d, yyyy')}
                </span>
                <span className="text-muted-foreground">—</span>
                <span className="font-medium">
                  {format(value.to, 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            {/* Calendar */}
            <div className="p-3">
              <Calendar
                mode="range"
                selected={{ from: value.from, to: value.to }}
                onSelect={handleCalendarSelect}
                numberOfMonths={2}
                defaultMonth={new Date(value.from.getFullYear(), value.from.getMonth())}
              />
            </div>

            {/* Bottom controls */}
            {(showComparison || showGranularity) && (
              <div className="border-t px-4 py-2.5 flex items-center gap-3">
                {showComparison && (
                  <button
                    onClick={handleCompareToggle}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      'border',
                      compareEnabled
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-transparent bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    Compare
                  </button>
                )}

                {showGranularity && (
                  <>
                    {showComparison && <Separator orientation="vertical" className="h-5" />}
                    <div className="flex items-center gap-1">
                      {GRANULARITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleGranularityClick(opt.value)}
                          className={cn(
                            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                            value.granularity === opt.value
                              ? 'bg-foreground text-background'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Hook for managing date range state
// ---------------------------------------------------------------------------

export function useDateRangeState(
  defaultPreset: DatePreset = 'last_30_days'
): [DateRangePickerValue, (v: DateRangePickerValue) => void] {
  const initial = getPresetDateRange(defaultPreset)
  const [value, setValue] = useState<DateRangePickerValue>({
    from: initial.from,
    to: initial.to,
    granularity: autoGranularity(initial.from, initial.to),
    preset: defaultPreset,
  })
  return [value, setValue]
}
