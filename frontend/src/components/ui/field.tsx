import {
  createContext,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useContext,
  useId,
} from 'react'
import { cn } from '../../lib/cn'

interface FieldContextValue {
  controlId: string
  descriptionIds?: string
  invalid: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

export function useFieldControl() {
  return useContext(FieldContext)
}

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  id?: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  children: ReactNode
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
  ...props
}: FieldProps) {
  const reactId = useId().replace(/:/g, '')
  const controlId = id ?? `ga-field-${reactId}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const descriptionIds = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <FieldContext.Provider value={{ controlId, descriptionIds, invalid: Boolean(error) }}>
      <div className={cn('grid gap-2', className)} {...props}>
        <label htmlFor={controlId} className="text-sm font-semibold text-text-primary">
          {label}
          {required && <span className="ml-1 text-danger" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {children}
        {error && (
          <p id={errorId} role="alert" className="text-sm leading-5 text-danger-text">
            {error}
          </p>
        )}
        {hint && (
          <p id={hintId} className="text-sm leading-5 text-text-muted">
            {hint}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

const controlClasses = 'electric-control min-h-11 w-full px-3.5 py-2.5 text-sm placeholder:text-text-disabled disabled:cursor-not-allowed disabled:border-border disabled:bg-elevated disabled:text-text-disabled disabled:opacity-75 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const field = useFieldControl()

  return (
    <input
      ref={ref}
      id={id ?? field?.controlId}
      aria-describedby={ariaDescribedBy ?? field?.descriptionIds}
      aria-invalid={(ariaInvalid ?? field?.invalid) || undefined}
      className={cn(controlClasses, className)}
      {...props}
    />
  )
})

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    rows = 4,
    ...props
  },
  ref,
) {
  const field = useFieldControl()

  return (
    <textarea
      ref={ref}
      id={id ?? field?.controlId}
      rows={rows}
      aria-describedby={ariaDescribedBy ?? field?.descriptionIds}
      aria-invalid={(ariaInvalid ?? field?.invalid) || undefined}
      className={cn(controlClasses, 'resize-y leading-6', className)}
      {...props}
    />
  )
})
