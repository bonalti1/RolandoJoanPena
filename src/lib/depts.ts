/**
 * Departments belong to a company, not to the app: each company keeps its own
 * list (added, renamed and deleted independently) under
 * `companies.deptsByCompany`. A company that has never been edited falls back
 * to the starting roster below.
 *
 * Shared so anything that files work against a department — the operating
 * review, the idea vault — reads exactly the same list.
 */
import { useStore } from './store'

export type Dept = { id: string; name: string }

export const SEED_DEPTS: Dept[] = [
  'Content', 'Ad spend', 'GHL', 'Appointment setter', 'Closer', 'Mortgage', 'Drafting',
  'Construction loans', 'T/C', 'Client communication', 'Permits, draws & payroll',
  'Scheduling / selections', 'QC / Runner', 'Accountant',
].map((name, i) => ({ id: `d${i}`, name }))

/** The departments of a given company, however they've been edited. */
export function useDeptsFor(): (company?: string) => Dept[] {
  const [byCompany] = useStore<Record<string, Dept[]>>('companies.deptsByCompany', {})
  return (company?: string) => (company && byCompany[company]) || SEED_DEPTS
}
