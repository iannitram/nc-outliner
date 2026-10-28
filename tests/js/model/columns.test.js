import { describe, expect, it } from 'vitest'
import { addColumn, newColumn, removeColumn, setColumnValue, sortRowsByColumn, summarizeColumn, updateColumn } from '../../../src/model/columns.js'

describe('column model', () => {
	it('adds, edits, resizes and removes columns and their cell values immutably', () => {
		const original = { title: 'Plan', columns: [], rows: [{ id: 'r1', text: 'one', values: {} }] }
		const withColumn = addColumn(original, 'Estimate', 'number')
		const column = withColumn.columns[0]
		const withValue = setColumnValue(withColumn, 'r1', column.id, 12)
		const resized = updateColumn(withValue, column.id, { name: 'Days', width: 20 })
		expect(resized.columns[0]).toMatchObject({ name: 'Days', width: 48, type: 'number' })
		expect(resized.rows[0].values[column.id]).toBe(12)
		expect(removeColumn(resized, column.id)).toMatchObject({ columns: [], rows: [{ values: {} }] })
		expect(original).toEqual({ title: 'Plan', columns: [], rows: [{ id: 'r1', text: 'one', values: {} }] })
	})

	it('removes values at parent and descendant levels', () => {
		const column = newColumn('Estimate', 'number')
		const outline = { columns: [column], rows: [{ id: 'p', values: { [column.id]: 5 }, children: [{ id: 'c', values: { [column.id]: 3 }, children: [] }] }] }
		const next = removeColumn(outline, column.id)
		expect(next.rows[0].values).toEqual({})
		expect(next.rows[0].children[0].values).toEqual({})
	})

	it('sorts every sibling list stably without mutating the outline tree', () => {
		const column = { id: 'rank', type: 'number' }
		const rows = [{ id: 'a', values: { rank: 2 }, children: [] }, { id: 'b', values: { rank: 1 }, children: [] }]
		expect(sortRowsByColumn(rows, column).map((row) => row.id)).toEqual(['b', 'a'])
		expect(rows.map((row) => row.id)).toEqual(['a', 'b'])
	})

	it('summarizes numeric descendant leaves and checkbox state', () => {
		const row = { children: [{ values: { x: 4, c: true }, children: [] }, { values: { x: 8, c: true }, children: [] }] }
		expect(summarizeColumn(row, { id: 'x', type: 'number' }, 'sum')).toBe(12)
		expect(summarizeColumn(row, { id: 'x', type: 'number' }, 'average')).toBe(6)
		expect(summarizeColumn(row, { id: 'c', type: 'checkbox' }, 'all')).toBe(true)
	})

	it('rejects unsupported types and preserves identity for missing targets', () => {
		expect(() => newColumn('X', 'unknown')).toThrow(TypeError)
		const outline = { columns: [], rows: [] }
		expect(removeColumn(outline, 'missing')).toBe(outline)
		expect(updateColumn(outline, 'missing', { name: 'x' })).toBe(outline)
		expect(setColumnValue(outline, 'missing', 'missing', 3)).toBe(outline)
	})
})
