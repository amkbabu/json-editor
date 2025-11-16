import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface JsonLine {
  id: string;
  content: string;
  level: number;
  hasToggle: boolean;
  isCollapsed: boolean;
  parentId: string | null;
  lineNumber: number;
  isClosing: boolean;
  originalKey: string | null;
  isArray: boolean;
  isObject: boolean;
  childCount: number;
}

@Component({
  selector: 'app-json-viewer',
  imports: [CommonModule],
  templateUrl: './json-viewer.html',
  styleUrl: './json-viewer.css',
})
export class JsonViewer {
  allLines: JsonLine[] = [];
  displayLines = signal<JsonLine[]>([]);
  activeLineIndex = signal<number>(-1);
  fileName = signal<string>('');
  rawJsonText = signal<string>('');
  viewMode = signal<'formatted' | 'textarea'>('formatted');
  isEditMode = signal<boolean>(false);
  editedText = signal<string>('');
  validationError = signal<string>('');
  editLines = signal<JsonLine[]>([]);
  editAllLines: JsonLine[] = [];
  hasUnsavedChanges = signal<boolean>(false);
  isValidJson = signal<boolean>(true);

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Please upload a valid .json file');
      input.value = '';
      return;
    }

    this.fileName.set(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        this.rawJsonText.set(JSON.stringify(jsonData, null, 2));
        this.parseAndDisplay(jsonData);
      } catch (error) {
        alert('Invalid JSON file. Please upload a valid JSON file.');
        this.displayLines.set([]);
        this.rawJsonText.set('');
        this.fileName.set('');
        input.value = '';
      }
    };

    reader.readAsText(file);
  }

  private parseAndDisplay(data: any): void {
    this.allLines = [];
    let idCounter = 0;
    
    const generateId = () => `line-${idCounter++}`;
    
    const buildLines = (value: any, key: string | null, level: number, parentId: string | null): string => {
      const currentId = generateId();
      const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const hasChildren = isObject || isArray;
      
      // Opening line
      let content = '  '.repeat(level);
      
      if (key !== null) {
        content += `<span class="key">"${key}"</span><span class="colon">: </span>`;
      }
      
      if (isObject) {
        const keys = Object.keys(value);
        content += '<span class="bracket">{</span>';
        this.allLines.push({
          id: currentId,
          content,
          level,
          hasToggle: true,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: false,
          isObject: true,
          childCount: keys.length
        });
        
        keys.forEach((k, index) => {
          const childId = buildLines(value[k], k, level + 1, currentId);
          if (index < keys.length - 1) {
            const lastLine = this.allLines[this.allLines.length - 1];
            lastLine.content += '<span class="comma">,</span>';
          }
        });
        
        // Closing brace
        const closeId = generateId();
        this.allLines.push({
          id: closeId,
          content: '  '.repeat(level) + '<span class="bracket">}</span>',
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId: currentId,
          lineNumber: 0,
          isClosing: true,
          originalKey: null,
          isArray: false,
          isObject: false,
          childCount: 0
        });
        
      } else if (isArray) {
        content += '<span class="bracket">[</span>';
        this.allLines.push({
          id: currentId,
          content,
          level,
          hasToggle: true,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: true,
          isObject: false,
          childCount: value.length
        });
        
        value.forEach((item: any, index: number) => {
          const childId = buildLines(item, null, level + 1, currentId);
          if (index < value.length - 1) {
            const lastLine = this.allLines[this.allLines.length - 1];
            lastLine.content += '<span class="comma">,</span>';
          }
        });
        
        // Closing bracket
        const closeId = generateId();
        this.allLines.push({
          id: closeId,
          content: '  '.repeat(level) + '<span class="bracket">]</span>',
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId: currentId,
          lineNumber: 0,
          isClosing: true,
          originalKey: null,
          isArray: false,
          isObject: false,
          childCount: 0
        });
        
      } else {
        // Primitive value
        if (typeof value === 'string') {
          content += `<span class="value-string">"${value}"</span>`;
        } else if (typeof value === 'number') {
          content += `<span class="value-number">${value}</span>`;
        } else if (typeof value === 'boolean') {
          content += `<span class="value-boolean">${value}</span>`;
        } else if (value === null) {
          content += `<span class="value-null">null</span>`;
        }
        
        this.allLines.push({
          id: currentId,
          content,
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: false,
          isObject: false,
          childCount: 0
        });
      }
      
      return currentId;
    };
    
    buildLines(data, null, 0, null);
    this.updateDisplayLines();
  }

  private updateDisplayLines(): void {
    const visibleLines: JsonLine[] = [];
    const collapsedParents = new Set<string>();
    
    // Find all collapsed parents
    this.allLines.forEach(line => {
      if (line.isCollapsed) {
        collapsedParents.add(line.id);
      }
    });
    
    // Filter visible lines
    for (const line of this.allLines) {
      let shouldShow = true;
      
      // Check if any ancestor is collapsed
      let currentParentId = line.parentId;
      while (currentParentId) {
        if (collapsedParents.has(currentParentId)) {
          shouldShow = false;
          break;
        }
        const parent = this.allLines.find(l => l.id === currentParentId);
        currentParentId = parent?.parentId || null;
      }
      
      if (shouldShow) {
        visibleLines.push(line);
      }
    }
    
    // Assign line numbers
    visibleLines.forEach((line, index) => {
      line.lineNumber = index + 1;
    });
    
    this.displayLines.set(visibleLines);
  }

  toggleCollapse(lineId: string): void {
    const line = this.allLines.find(l => l.id === lineId);
    if (line && line.hasToggle) {
      line.isCollapsed = !line.isCollapsed;
      
      // Update the content to show collapsed state
      if (line.isCollapsed) {
        const indent = '  '.repeat(line.level);
        const keyPart = line.originalKey ? `<span class="key">"${line.originalKey}"</span><span class="colon">: </span>` : '';
        
        if (line.isObject) {
          line.content = `${indent}${keyPart}<span class="bracket">{...}</span> <span class="comment">// ${line.childCount} properties</span>`;
        } else if (line.isArray) {
          line.content = `${indent}${keyPart}<span class="bracket">[...]</span> <span class="comment">// ${line.childCount} items</span>`;
        }
      } else {
        // Restore original content
        const indent = '  '.repeat(line.level);
        const keyPart = line.originalKey ? `<span class="key">"${line.originalKey}"</span><span class="colon">: </span>` : '';
        
        if (line.isObject) {
          line.content = `${indent}${keyPart}<span class="bracket">{</span>`;
        } else if (line.isArray) {
          line.content = `${indent}${keyPart}<span class="bracket">[</span>`;
        }
      }
      
      this.updateDisplayLines();
    }
  }

  setActiveLine(index: number): void {
    this.activeLineIndex.set(index);
  }

  getToggleIcon(line: JsonLine): string {
    return line.isCollapsed ? '▶' : '▼';
  }

  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'formatted' ? 'textarea' : 'formatted');
  }

  getPlainTextContent(line: JsonLine): string {
    // Strip HTML tags to get plain text
    const div = document.createElement('div');
    div.innerHTML = line.content;
    return div.textContent || div.innerText || '';
  }

  toggleEditMode(): void {
    if (!this.isEditMode()) {
      // Enter edit mode
      this.editedText.set(this.rawJsonText());
      this.validationError.set('');
      this.hasUnsavedChanges.set(false);
      this.isValidJson.set(true);
      this.isEditMode.set(true);
      this.viewMode.set('textarea'); // Switch to textarea for editing
      
      // Parse current JSON into editable lines
      try {
        const jsonData = JSON.parse(this.rawJsonText());
        this.parseEditLines(jsonData);
      } catch (error) {
        this.editLines.set([]);
      }
    } else {
      // Check for unsaved changes
      if (this.hasUnsavedChanges()) {
        const confirmed = confirm('You have unsaved changes. Are you sure you want to exit without saving?');
        if (!confirmed) return;
      }
      
      // Exit edit mode without saving
      this.isEditMode.set(false);
      this.validationError.set('');
      this.hasUnsavedChanges.set(false);
      this.editLines.set([]);
    }
  }

  onTextChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.editedText.set(textarea.value);
    this.validationError.set(''); // Clear error on change
  }

  validateAndSave(): void {
    // Reconstruct JSON from edit lines
    const jsonText = this.reconstructJsonFromLines();
    
    try {
      // Validate JSON
      const jsonData = JSON.parse(jsonText);
      
      // Update the viewer with new data
      this.rawJsonText.set(JSON.stringify(jsonData, null, 2));
      this.parseAndDisplay(jsonData);
      
      // Exit edit mode
      this.isEditMode.set(false);
      this.validationError.set('');
      this.hasUnsavedChanges.set(false);
      this.isValidJson.set(true);
      this.editLines.set([]);
      
      // Show success message
      alert('✓ JSON is valid and saved successfully!');
    } catch (error) {
      // Show validation error
      if (error instanceof Error) {
        this.validationError.set(`Invalid JSON: ${error.message}`);
        this.isValidJson.set(false);
      } else {
        this.validationError.set('Invalid JSON format');
        this.isValidJson.set(false);
      }
    }
  }

  downloadJson(): void {
    const jsonText = this.rawJsonText();
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.fileName() || 'edited.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  private parseEditLines(data: any): void {
    this.editAllLines = [];
    let idCounter = 0;
    
    const generateId = () => `edit-line-${idCounter++}`;
    
    const buildEditLines = (value: any, key: string | null, level: number, parentId: string | null): string => {
      const currentId = generateId();
      const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
      const isArray = Array.isArray(value);
      
      let content = '  '.repeat(level);
      
      if (key !== null) {
        content += `"${key}": `;
      }
      
      if (isObject) {
        const keys = Object.keys(value);
        content += '{';
        this.editAllLines.push({
          id: currentId,
          content,
          level,
          hasToggle: true,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: false,
          isObject: true,
          childCount: keys.length
        });
        
        keys.forEach((k, index) => {
          buildEditLines(value[k], k, level + 1, currentId);
          if (index < keys.length - 1) {
            const lastLine = this.editAllLines[this.editAllLines.length - 1];
            lastLine.content += ',';
          }
        });
        
        const closeId = generateId();
        this.editAllLines.push({
          id: closeId,
          content: '  '.repeat(level) + '}',
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId: currentId,
          lineNumber: 0,
          isClosing: true,
          originalKey: null,
          isArray: false,
          isObject: false,
          childCount: 0
        });
        
      } else if (isArray) {
        content += '[';
        this.editAllLines.push({
          id: currentId,
          content,
          level,
          hasToggle: true,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: true,
          isObject: false,
          childCount: value.length
        });
        
        value.forEach((item: any, index: number) => {
          buildEditLines(item, null, level + 1, currentId);
          if (index < value.length - 1) {
            const lastLine = this.editAllLines[this.editAllLines.length - 1];
            lastLine.content += ',';
          }
        });
        
        const closeId = generateId();
        this.editAllLines.push({
          id: closeId,
          content: '  '.repeat(level) + ']',
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId: currentId,
          lineNumber: 0,
          isClosing: true,
          originalKey: null,
          isArray: false,
          isObject: false,
          childCount: 0
        });
        
      } else {
        if (typeof value === 'string') {
          content += `"${value}"`;
        } else if (typeof value === 'number') {
          content += `${value}`;
        } else if (typeof value === 'boolean') {
          content += `${value}`;
        } else if (value === null) {
          content += `null`;
        }
        
        this.editAllLines.push({
          id: currentId,
          content,
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: false,
          isObject: false,
          childCount: 0
        });
      }
      
      return currentId;
    };
    
    buildEditLines(data, null, 0, null);
    this.updateEditDisplayLines();
  }

  private updateEditDisplayLines(): void {
    const visibleLines: JsonLine[] = [];
    const collapsedParents = new Set<string>();
    
    this.editAllLines.forEach(line => {
      if (line.isCollapsed) {
        collapsedParents.add(line.id);
      }
    });
    
    for (const line of this.editAllLines) {
      let shouldShow = true;
      
      let currentParentId = line.parentId;
      while (currentParentId) {
        if (collapsedParents.has(currentParentId)) {
          shouldShow = false;
          break;
        }
        const parent = this.editAllLines.find(l => l.id === currentParentId);
        currentParentId = parent?.parentId || null;
      }
      
      if (shouldShow) {
        visibleLines.push(line);
      }
    }
    
    visibleLines.forEach((line, index) => {
      line.lineNumber = index + 1;
    });
    
    this.editLines.set(visibleLines);
  }

  toggleEditCollapse(lineId: string): void {
    const line = this.editAllLines.find(l => l.id === lineId);
    if (line && line.hasToggle) {
      line.isCollapsed = !line.isCollapsed;
      
      if (line.isCollapsed) {
        const indent = '  '.repeat(line.level);
        const keyPart = line.originalKey ? `"${line.originalKey}": ` : '';
        
        if (line.isObject) {
          line.content = `${indent}${keyPart}{...} // ${line.childCount} properties`;
        } else if (line.isArray) {
          line.content = `${indent}${keyPart}[...] // ${line.childCount} items`;
        }
      } else {
        const indent = '  '.repeat(line.level);
        const keyPart = line.originalKey ? `"${line.originalKey}": ` : '';
        
        if (line.isObject) {
          line.content = `${indent}${keyPart}{`;
        } else if (line.isArray) {
          line.content = `${indent}${keyPart}[`;
        }
      }
      
      this.updateEditDisplayLines();
    }
  }

  onLineContentChange(lineId: string, event: Event): void {
    const element = event.target as HTMLElement;
    
    // Save cursor position
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const cursorOffset = range?.startOffset || 0;
    const currentNode = range?.startContainer;
    
    const newContent = element.textContent || '';
    
    const line = this.editAllLines.find(l => l.id === lineId);
    if (line) {
      line.content = newContent;
      this.hasUnsavedChanges.set(true);
      this.validateJsonInRealTime();
      
      // Restore cursor position after Angular updates
      setTimeout(() => {
        if (currentNode && element.contains(currentNode)) {
          const newRange = document.createRange();
          const newSelection = window.getSelection();
          
          try {
            newRange.setStart(currentNode, Math.min(cursorOffset, currentNode.textContent?.length || 0));
            newRange.collapse(true);
            newSelection?.removeAllRanges();
            newSelection?.addRange(newRange);
          } catch (e) {
            // If cursor position restore fails, place at end
            newRange.selectNodeContents(element);
            newRange.collapse(false);
            newSelection?.removeAllRanges();
            newSelection?.addRange(newRange);
          }
        }
      }, 0);
    }
  }

  private validateJsonInRealTime(): void {
    try {
      const jsonText = this.reconstructJsonFromLines();
      JSON.parse(jsonText);
      this.validationError.set('');
      this.isValidJson.set(true);
    } catch (error) {
      if (error instanceof Error) {
        this.validationError.set(`Syntax Error: ${error.message}`);
      }
      this.isValidJson.set(false);
    }
  }

  private reconstructJsonFromLines(): string {
    const visibleLines = this.editAllLines.filter(line => {
      let shouldShow = true;
      let currentParentId = line.parentId;
      
      while (currentParentId) {
        const parent = this.editAllLines.find(l => l.id === currentParentId);
        if (parent?.isCollapsed) {
          shouldShow = false;
          break;
        }
        currentParentId = parent?.parentId || null;
      }
      
      return shouldShow;
    });
    
    return visibleLines.map(line => line.content).join('\n');
  }

  formatJson(): void {
    try {
      const jsonText = this.reconstructJsonFromLines();
      const jsonData = JSON.parse(jsonText);
      this.parseEditLines(jsonData);
      this.hasUnsavedChanges.set(true);
      this.validationError.set('');
      this.isValidJson.set(true);
    } catch (error) {
      if (error instanceof Error) {
        this.validationError.set(`Cannot format: ${error.message}`);
      }
    }
  }

  onKeyDown(event: KeyboardEvent, lineId: string): void {
    // Ctrl+S or Cmd+S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.validateAndSave();
    }
    
    // Tab key handling
    if (event.key === 'Tab') {
      event.preventDefault();
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      if (range) {
        const tabNode = document.createTextNode('  ');
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }
}
