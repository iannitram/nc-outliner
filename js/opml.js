// Escape helper functions
const escapeAttr = (str) => {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/\n/g, '&#10;');
};

const escapeTitle = (str) => {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
};

// Serialize OPML function
export const serializeOpml = (doc) => {
	let result = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0" xmlns:ol="urn:nc-outliner:ns:1">\n  <head>\n    <title>${escapeTitle(doc.title)}</title>\n  </head>\n`;

	if (doc.rows.length === 0) {
		result += '  <body/>\n</opml>\n';
		return result;
	}

	result += '  <body>\n';

	const serializeRow = (row, level) => {
		let indent = '  '.repeat(level); // Exactly 2 spaces per level
		let attrs = [];
		
		// Add attributes in specific order to match test expectations 
		if (row.text !== undefined) {
			attrs.push(`text="${escapeAttr(row.text)}"`);
		}
		
		if (row.note !== '') {
			attrs.push(`_note="${escapeAttr(row.note)}"`);
		}
		
		attrs.push(`ol:id="${row.id}"`);
		
		if (row.collapsed) {
			attrs.push('ol:collapsed="true"');
		}
		
		if (row.noteOpen) {
			attrs.push('ol:noteOpen="true"');
		}
		
		// Handle extra attributes - these should come last in alphabetical order
		const extraAttrs = [];
		if (row.extra && typeof row.extra === 'object') {
			for (const [key, value] of Object.entries(row.extra)) {
				extraAttrs.push(`${key}="${escapeAttr(value)}"`);
			}
		}
		
		// Sort extra attributes alphabetically
		extraAttrs.sort();
		attrs = attrs.concat(extraAttrs);

		if ((row.children && row.children.length === 0) || !row.children) {
			result += `${indent}<outline ${attrs.join(' ')}/>\n`;
		} else {
			result += `${indent}<outline ${attrs.join(' ')}>\n`;
			// Ensure children is an array for forEach
			const childrenArray = Array.isArray(row.children) ? row.children : [];
			childrenArray.forEach(child => serializeRow(child, level + 1));
			result += `${indent}</outline>\n`;
		}
	};

	doc.rows.forEach(row => serializeRow(row, 2)); // Start at level 2 (for body's children)

	result += '  </body>\n</opml>\n';
	return result;
};

// Parse OPML function
export const parseOpml = (xml, newId) => {
	// Check for valid root element
	if (!xml.includes('<opml')) {
		throw new Error('Invalid OPML: Root element must be opml');
	}
	
	// Find title
	let title = '';
	const titleMatch = xml.match(/<title>(.*?)<\/title>/s);
	if (titleMatch) {
		title = titleMatch[1]
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&#(\d+);/g, (match, code) => String.fromCharCode(code))
			.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
	}
	
	// Find body
	const bodyMatch = xml.match(/<body[^>]*>(.*?)<\/body>/s);
	if (!bodyMatch) {
		throw new Error('Invalid OPML: Missing body element');
	}
	
	const bodyContent = bodyMatch[1];
	
	// Parse outline elements using a simpler, more reliable approach
	const parseOutlineElements = (content, idGenerator) => {
		const rows = [];
		
		while (content.length > 0) {
			// Look for an opening outline tag
			const openTagIndex = content.indexOf('<outline');
			if (openTagIndex === -1) break;
			
			// Find the end of this tag 
			const tagEndIndex = content.indexOf('>', openTagIndex);
			if (tagEndIndex === -1) break;
			
			const fullTag = content.substring(openTagIndex, tagEndIndex + 1);
			
			// Check if it's self-closing
			const isSelfClosing = fullTag.endsWith('/>');
			
			const row = {
				text: '',
				id: '',
				note: '',
				collapsed: false,
				noteOpen: false,
				children: []
			};
			
			// Keep track of all attributes found that are not standard ones
			const extraAttributes = {};
			
			// Extract all attributes using regex - but we must be careful about quotes
			let attrMatch;
			const attrRegex = /([a-zA-Z0-9:_\-]+)=["']([^"']*?)["']/g;
			while ((attrMatch = attrRegex.exec(fullTag)) !== null) {
				const key = attrMatch[1];
				const value = attrMatch[2]
					.replace(/&amp;/g, '&')
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>')
					.replace(/&quot;/g, '"')
					.replace(/&#(\d+);/g, (match, code) => String.fromCharCode(code))
					.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
					
				if (key === 'text') {
					row.text = value;
				} else if (key === 'ol:id') {
					row.id = value;
				} else if (key === '_note') {
					row.note = value;
				} else if (key === 'ol:collapsed') {
					row.collapsed = value === 'true';
				} else if (key === 'ol:noteOpen') {
					row.noteOpen = value === 'true';
				} else {
					// This is an extra attribute - store it separately
					extraAttributes[key] = value;
				}
			}
			
			// If we found any extra attributes, put them in the row's extra object
			if (Object.keys(extraAttributes).length > 0) {
				row.extra = extraAttributes;
			}
			
			// If id is missing, generate it using the generator function
			if (!row.id) {
				row.id = idGenerator();
			}
			
			content = content.substring(tagEndIndex + 1);
			
			if (isSelfClosing) {
				rows.push(row);
			} else {
				// For non-self-closing tags - find the matching closing tag
				const closeTagStart = content.indexOf('</outline>');
				if (closeTagStart === -1) {
					throw new Error('Invalid OPML: Unmatched opening outline tag');
				}
				
				const innerContent = content.substring(0, closeTagStart);
				content = content.substring(closeTagStart + '</outline>'.length);
				
				// Parse children recursively
				const childResult = parseOutlineElements(innerContent, idGenerator);
				row.children = childResult;
				
				rows.push(row);
			}
		}
		
		return rows;
	};
	
	try {
		const parsedRows = parseOutlineElements(bodyContent, newId);
		return { title, rows: parsedRows };
	} catch (error) {
		throw new Error('Invalid OPML: ' + error.message);
	}
};