/**
 * Create a new row with the given id and optional text.
 * @param {string} id - The unique identifier for the row
 * @param {string} text - Optional text content for the row
 * @returns {Row} A new row object
 */
export function createRow(id, text = '') {
	return {
		id,
		text,
		note: '',
		noteOpen: false,
		collapsed: false,
		children: []
	};
}

/**
 * Generate a new unique row ID.
 * @returns {string} A new row ID in the format 'r' followed by 8 random base-36 characters
 */
export function newRowId() {
	let id = 'r';
	for (let i = 0; i < 8; i++) {
		id += Math.random().toString(36).substring(2, 3);
	}
	return id;
}

/**
 * Find a row by its ID in the tree.
 * @param {Row[]} rows - The array of rows to search
 * @param {string} id - The ID of the row to find
 * @returns {{row: Row, parent: Row|null, index: number}|null} The found row with context or null if not found
 */
export function findRow(rows, id) {
	function search(parent, currentRows) {
		for (let i = 0; i < currentRows.length; i++) {
			const row = currentRows[i];
			if (row.id === id) {
				return { row, parent, index: i };
			}
			const result = search(row, row.children);
			if (result) {
				return result;
			}
		}
		return null;
	}

	return search(null, rows);
}

/**
 * Insert a new row after the specified row.
 * @param {Row[]} rows - The array of rows to modify
 * @param {string} afterId - The ID of the row after which to insert
 * @param {Row} newRow - The new row to insert
 * @returns {Row[]} The modified array of rows
 */
export function insertRowAfter(rows, afterId, newRow) {
	// Find the row to insert after
	const foundRow = findRow(rows, afterId);
	if (!foundRow) {
		return rows;
	}

	// If we're inserting at top level (after a root row)
	if (foundRow.parent === null) {
		const newRows = [...rows];
		newRows.splice(foundRow.index + 1, 0, newRow);
		return newRows;
	} else {
		// Otherwise, insert within children of parent
		function updateParent(parentRow) {
			if (parentRow.id === foundRow.parent.id) {
				const newChildren = [...parentRow.children];
				newChildren.splice(foundRow.index + 1, 0, newRow);
				return { ...parentRow, children: newChildren };
			} else {
				return {
					...parentRow,
					children: parentRow.children.map(updateParent)
				};
			}
		}

		return rows.map(row => updateParent(row));
	}
}

/**
 * Set the text of a row by its ID.
 * @param {Row[]} rows - The array of rows to modify
 * @param {string} id - The ID of the row whose text to set
 * @param {string} text - The new text content
 * @returns {Row[]} The modified array of rows
 */
export function setRowText(rows, id, text) {
	let found = false;
	
	function mapRow(currentRows) {
		return currentRows.map(row => {
			if (row.id === id) {
				found = true;
				return { ...row, text };
			}
			return {
				...row,
				children: mapRow(row.children)
			};
		});
	}

	const result = mapRow(rows);
	
	// If we didn't find the row, return original reference
	if (!found) {
		return rows;
	}
	
	return result;
}

/**
 * Delete a row by its ID and all its children.
 * @param {Row[]} rows - The array of rows to modify
 * @param {string} id - The ID of the row to delete
 * @returns {Row[]} The modified array of rows
 */
export function deleteRow(rows, id) {
	let found = false;
	
	function processChildren(currentRows) {
		const filteredRows = [];
		
		for (let i = 0; i < currentRows.length; i++) {
			const row = currentRows[i];
			
			if (row.id === id) {
				found = true;
				// Skip this node - it's being deleted
				continue;
			}
			
			// Process children recursively 
			const processedChildren = processChildren(row.children);
			
			// Add the current node with updated children
			filteredRows.push({
				...row,
				children: processedChildren
			});
		}
		
		return filteredRows;
	}

	const result = processChildren(rows);
	
	// If we didn't find anything to delete, return original reference
	if (!found) {
		return rows;
	}
	
	return result;
}

/**
 * Flatten the visible rows in display order.
 * @param {Row[]} rows - The array of rows to flatten
 * @returns {{id: string, depth: number}[]} An array of objects with row IDs and depths
 */
export function flattenVisible(rows) {
	const result = [];
	
	function traverse(currentRows, depth = 0) {
		for (const row of currentRows) {
			result.push({ id: row.id, depth });
			if (!row.collapsed) {
				traverse(row.children, depth + 1);
			}
		}
	}

	traverse(rows);
	return result;
}

/**
 * Get the ID of a neighbor row in display order.
 * @param {Row[]} rows - The array of rows to search
 * @param {string} id - The ID of the reference row
 * @param {number} dir - Direction (-1 for previous, 1 for next)
 * @returns {string|null} The ID of the neighbor or null if none exists
 */
export function neighborId(rows, id, dir) {
	const flat = flattenVisible(rows);
	const index = flat.findIndex(item => item.id === id);
	
	if (index === -1) {
		return null;
	}
	
	if (dir === -1 && index > 0) {
		return flat[index - 1].id;
	} else if (dir === 1 && index < flat.length - 1) {
		return flat[index + 1].id;
	}
	
	return null;
}