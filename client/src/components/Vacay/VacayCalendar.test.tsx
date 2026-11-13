import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../../tests/helpers/render'
import { resetAllStores, seedStore } from '../../../tests/helpers/store'
import { useVacayStore } from '../../store/vacayStore'
import VacayCalendar from './VacayCalendar'

vi.mock('./VacayMonthCard', () => ({
  default: ({ month, onCellClick }: any) => (
    <div data-testid={`month-card-${month}`}>
      <button onClick={() => onCellClick(`2025-01-${String(month + 1).padStart(2, '0')}`)}>
        click-{month}
      </button>
    </div>
  ),
}))

const basePlan = {
  id: 1,
  holidays_enabled: false,
  holidays_region: null,
  holiday_calendars: [],
  block_weekends: false,
  carry_over_enabled: false,
  company_holidays_enabled: true,
}

beforeEach(() => {
  resetAllStores()
})

describe('VacayCalendar', () => {
  it('FE-COMP-VACAYCALENDAR-001: renders 12 month cards', () => {
    seedStore(useVacayStore, {
      selectedYear: 2025,
      entries: [],
      companyHolidays: [],
      holidays: {},
      plan: basePlan,
      users: [],
      selectedUserId: null,
    })

    render(<VacayCalendar />)

    expect(screen.getAllByTestId(/^month-card-/)).toHaveLength(12)
  })

  it('removes the floating calendar selector and holiday import controls', () => {
    seedStore(useVacayStore, {
      selectedYear: 2025,
      entries: [],
      companyHolidays: [],
      holidays: {},
      plan: basePlan,
      users: [{ id: 1, username: 'Alice', color: '#ec4899' }],
      selectedUserId: 1,
    })

    render(<VacayCalendar />)

    expect(screen.getAllByRole('button')).toHaveLength(12)
    expect(screen.queryByText('Add U.S. federal holidays')).not.toBeInTheDocument()
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('FE-COMP-VACAYCALENDAR-006: cell click in vacation mode calls toggleEntry', async () => {
    const user = userEvent.setup()
    const toggleEntry = vi.fn().mockResolvedValue(undefined)

    seedStore(useVacayStore, {
      selectedYear: 2025,
      entries: [],
      companyHolidays: [],
      holidays: {},
      plan: { ...basePlan, block_weekends: false, company_holidays_enabled: false },
      users: [],
      selectedUserId: 42,
      toggleEntry,
    })

    render(<VacayCalendar />)

    // Click the first month card cell button (month 0 → date '2025-01-01')
    await user.click(screen.getByText('click-0'))

    expect(toggleEntry).toHaveBeenCalledWith('2025-01-01', 42)
  })

  it('opens existing vacation details when clicking a booked day', async () => {
    const user = userEvent.setup()
    seedStore(useVacayStore, {
      selectedYear: 2025,
      entries: [{ date: '2025-01-01', user_id: 42, person_name: 'Alice', person_color: '#ec4899' }],
      companyHolidays: [],
      holidays: {},
      plan: basePlan,
      users: [{ id: 42, username: 'Alice', color: '#ec4899' }],
      selectedUserId: 42,
    })

    render(<VacayCalendar />)
    await user.click(screen.getByText('click-0'))

    expect(screen.getByText('Planned vacation')).toBeInTheDocument()
  })

  it('FE-COMP-VACAYCALENDAR-007: cell click on public holiday toggles vacation entry', async () => {
    const user = userEvent.setup()
    const toggleEntry = vi.fn().mockResolvedValue(undefined)

    seedStore(useVacayStore, {
      selectedYear: 2025,
      entries: [],
      companyHolidays: [],
      holidays: { '2025-01-01': { name: 'New Year', localName: 'Neujahr', color: '#f00', label: null } },
      plan: { ...basePlan, block_weekends: false, company_holidays_enabled: false },
      users: [],
      selectedUserId: null,
      toggleEntry,
    })

    render(<VacayCalendar />)

    // Month 0, button emits '2025-01-01' which is a holiday — should still toggle vacation
    await user.click(screen.getByText('click-0'))

    expect(toggleEntry).toHaveBeenCalledWith('2025-01-01', undefined)
  })

})
