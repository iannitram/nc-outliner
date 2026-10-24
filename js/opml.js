/**
 * Serialize a document to OPML format
 * @param {Object} doc - The document to serialize
 * @returns {string} The OPML string representation
 */
export function serializeOpml(doc) {
  const escapeXml = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '&#10;');
  };

  const indent = (level) => '  '.repeat(level);
  
  let result = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0" xmlns:ol="urn:nc-outliner:ns:1">\n  <head>\n    <title>${escapeXml(doc.title)}</title>\n  </head>\n  <body`;
  
  if (doc.rows.length === 0) {
    result += '/>\n</opml>\n';
  } else {
    const serializeRow = (row, level) => {
      const attrs = [];
      
      // Always include text attribute
      attrs.push(`text="${escapeXml(row.text)}"`);
      
      // Include _note if not empty
      if (row.note !== '') {
        attrs.push(`_note="${escapeXml(row.note)}"`);
      }
      
      // Always include ol:id
      attrs.push(`ol:id="${row.id}"`);
      
      // Include ol:collapsed if true
      if (row.collapsed) {
        attrs.push('ol:collapsed="true"');
      }
      
      // Include ol:noteOpen if true
      if (row.noteOpen) {
        attrs.push('ol:noteOpen="true"');
      }
      
      // Include any extra attributes in their original order
      if (row.extra) {
        for (const [key, value] of Object.entries(row.extra)) {
          attrs.push(`${key}="${escapeXml(value)}"`);
        }
      }
      
      const attrString = attrs.join(' ');
      
      if (row.children.length === 0) {
        // Self-closing outline element
        return `${indent(level)}<outline ${attrString}/>`;
      } else {
        // Opening outline element with children
        let line = `${indent(level)}<outline ${attrString}>`;
        row.children.forEach(child => {
          line += '\n' + serializeRow(child, level + 1);
        });
        line += `\n${indent(level)}</outline>`;
        return line;
      }
    };
    
    result += '>\n';
    doc.rows.forEach(row => {
      result += serializeRow(row, 2) + '\n';
    });
    result += '  </body>\n</opml>\n';
  }
  
  return result;
}

/**
 * Parse an OPML string into a document
 * @param {string} xml - The XML string to parse
 * @param {Function} newId - Function that returns a new ID when needed
 * @returns {Object} The parsed document
 */
export function parseOpml(xml, newId) {
  // Check basic structure  
  if (!xml.startsWith('<?xml')) {
    throw new Error('Invalid OPML: Missing XML declaration');
  }

  const opmlMatch = xml.match(/<opml[^>]*>/);
  if (!opmlMatch || !opmlMatch[0].includes('version="2.0"')) {
    throw new Error('Invalid OPML: Root element must be <opml version="2.0">');
  }

  // Extract title
  const titleMatch = xml.match(/<title>(.*?)<\/title>/);
  let title = '';
  if (titleMatch) {
    title = titleMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#10;/g, '\n');
  }
  
  let rows = [];
  
  // Find body content
  const bodyMatch = xml.match(/<body[^>]*>(.*?)<\/body>/s);
  if (!bodyMatch) {
    return { title, rows };
  }

  const bodyContent = bodyMatch[1];
  
  // Very simple approach: split the body by outline elements at top level  
  let content = bodyContent.trim();
  while (content.length > 0) {
    // Find first <outline> opening tag
    const openPos = content.indexOf('<outline');
    if (openPos === -1) break;
    
    // Find its closing tag to get the full element 
    let depth = 0;
    let closePos = -1;
    let i = openPos;
    
    while (i < content.length) {
      if (content[i] === '<' && content.substr(i, 7) === '<outline') {
        const nextChar = content[i + 7];
        if (nextChar !== '>' && nextChar !== '/') { 
          depth++;  
        }
      } else if (content[i] === '<' && content.substr(i, 2) === '</') {
        if (content.substr(i+2, 8) === 'outline>') {
          depth--;
          if (depth === -1) {
            closePos = i;
            break;
          }
        }
      }
      i++;
    }

    // Extract the full element
    let fullElement;
    if (closePos !== -1) {
      fullElement = content.substring(openPos, closePos + 9); 
    } else {
      const slashMatch = content.indexOf('/>');
      if (slashMatch !== -1) {
        fullElement = content.substring(openPos, slashMatch + 2);
      } else {
        break; 
      }
    }

    // Extract attributes
    let attrsString = '';
    
    // Get the part after 'outline' in the opening tag to extract attributes
    const openBracketPos = fullElement.indexOf('<outline');
    if (openBracketPos !== -1) {
      const nextSpaceOrClose = fullElement.indexOf(' ', openBracketPos + 7);
      const closeBracketPos = fullElement.indexOf('>', openBracketPos + 7);
      
      // Extract attributes between the opening tag and closing bracket
      if (nextSpaceOrClose !== -1 && nextSpaceOrClose < closeBracketPos) {
        attrsString = fullElement.substring(nextSpaceOrClose, closeBracketPos).trim();
      } else if (closeBracketPos !== -1) {
        // Just the opening tag with no attributes
        attrsString = '';
      }
    }

    const attrs = {};
    
    // Parse all key="value" attribute pairs
    const attrRegex = /([^=\s]+)=["']([^"']*)["']/g;
    let attrMatch;
    
    while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
      let value = attrMatch[2];
      
      // Unescape XML entities in the attribute values
      value = value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#10;/g, '\n');
      
      attrs[attrMatch[1]] = value;
    }
    
    // Create the row with all attributes
    const row = {
      text: attrs.text || '',
      note: attrs._note || '',
      id: attrs['ol:id'] || newId(),
      collapsed: attrs['ol:collapsed'] === 'true',
      noteOpen: attrs['ol:noteOpen'] === 'true',
      children: []
    };
    
    // Handle extra attributes
    const extra = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (!['text', '_note', 'ol:id', 'ol:collapsed', 'ol:noteOpen'].includes(key)) {
        extra[key] = value;
      }
    }

    if (Object.keys(extra).length > 0) {
      row.extra = extra;
    }
    
    // If this is not a self-closing tag, parse children
    if (!fullElement.includes('/>')) { 
      const contentStart = fullElement.indexOf('>') + 1;
      let contentEnd = fullElement.lastIndexOf('</outline>');
      
      if (contentStart > -1 && contentEnd > contentStart) {
        const innerContent = fullElement.substring(contentStart, contentEnd);
        
        // Parse children recursively
        if (innerContent.trim() !== '') {
          // We need to parse all nested outline elements within this element 
          let childPos = 0;
          
          while (childPos < innerContent.length) {
            const childOpenPos = innerContent.indexOf('<outline', childPos);
            
            if (childOpenPos === -1) break;
            
            // Find the matching closing tag for this child
            let childDepth = 0;
            let childClosePos = -1;
            let j = childOpenPos;
            
            while (j < innerContent.length) {
              if (innerContent[j] === '<' && innerContent.substr(j, 7) === '<outline') {
                const nextChar = innerContent[j + 7];
                if (nextChar !== '>' && nextChar !== '/') { 
                  childDepth++;  
                }
              } else if (innerContent[j] === '<' && innerContent.substr(j, 2) === '</') {
                if (innerContent.substr(j+2, 8) === 'outline>') {
                  childDepth--;
                  if (childDepth === -1) {
                    childClosePos = j;
                    break;
                  }
                }
              }
              j++;
            }

            // Extract the full child element
            let childFullElement;
            if (childClosePos !== -1) {
              childFullElement = innerContent.substring(childOpenPos, childClosePos + 9); 
            } else {
              const slashMatch = innerContent.indexOf('/>');
              if (slashMatch !== -1) {
                childFullElement = innerContent.substring(childOpenPos, slashMatch + 2);
              } else {
                break; 
              }
            }

            // Extract attributes for the child
            let childAttrsString = '';
            
            const childOpenBracketPos = childFullElement.indexOf('<outline');
            if (childOpenBracketPos !== -1) {
              const nextSpaceOrClose = childFullElement.indexOf(' ', childOpenBracketPos + 7);
              const closeBracketPos = childFullElement.indexOf('>', childOpenBracketPos + 7);
              
              // Extract attributes between the opening tag and closing bracket
              if (nextSpaceOrClose !== -1 && nextSpaceOrClose < closeBracketPos) {
                childAttrsString = childFullElement.substring(nextSpaceOrClose, closeBracketPos).trim();
              } else if (closeBracketPos !== -1) {
                // Just the opening tag with no attributes
                childAttrsString = '';
              }
            }

            const childAttrs = {};
            
            // Parse all key="value" attribute pairs for child
            let attrMatch2;
            while ((attrMatch2 = attrRegex.exec(childAttrsString)) !== null) {
              let value = attrMatch2[2];
              
              // Unescape XML entities in the attribute values
              value = value
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#10;/g, '\n');
              
              childAttrs[attrMatch2[1]] = value;
            }
            
            // Create the child row
            const childRow = {
              text: childAttrs.text || '',
              note: childAttrs._note || '',
              id: childAttrs['ol:id'] || newId(),
              collapsed: childAttrs['ol:collapsed'] === 'true',
              noteOpen: childAttrs['ol:noteOpen'] === 'true',
              children: []
            };
            
            // Handle extra attributes for child
            const childExtra = {};
            for (const [key, value] of Object.entries(childAttrs)) {
              if (!['text', '_note', 'ol:id', 'ol:collapsed', 'ol:noteOpen'].includes(key)) {
                childExtra[key] = value;
              }
            }

            if (Object.keys(childExtra).length > 0) {
              childRow.extra = childExtra;
            }
            
            row.children.push(childRow);
            
            // Advance past this element
            const nextChildPos = childClosePos !== -1 ? childClosePos + 9 : 
                                (childFullElement.indexOf('/>') !== -1 ? childFullElement.indexOf('/>') + 2 : childFullElement.length);
            childPos = nextChildPos;
          }
        }
      }
    }

    rows.push(row);

    // Advance beyond this processed outline element  
    const nextPos = fullElement.lastIndexOf('</outline>') + 9; 
    if (nextPos > 0) {
      content = content.substring(nextPos).trim();
    } else {
      // Try to find the end of the opening tag for self-closing elements
      const slashPos = fullElement.indexOf('/>');
      if (slashPos !== -1) {
        content = content.substring(slashPos + 2).trim();  
      } else {
        break;
      }
    }
  }

  return { title, rows };
}