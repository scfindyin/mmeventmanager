"use client"

import React from 'react';
import Editor, { 
  BtnBold,
  BtnItalic,
  BtnBulletList,
  BtnNumberedList,
  BtnUndo,
  BtnRedo,
  BtnClearFormatting,
  BtnStyles,
  Separator,
  Toolbar
} from 'react-simple-wysiwyg';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Add a description for this agenda item",
  disabled = false,
  className = ""
}: RichTextEditorProps) {
  
  // Convert plain text to HTML for backward compatibility
  const convertPlainTextToHtml = (text: string): string => {
    if (!text) return '';
    
    // Check if it's already HTML
    if (text.includes('<') && text.includes('>')) {
      return text;
    }
    
    // Convert line breaks to <p> tags for better formatting
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    if (paragraphs.length === 0) return '';
    if (paragraphs.length === 1) return `<p>${paragraphs[0]}</p>`;
    
    return paragraphs.map(p => `<p>${p}</p>`).join('');
  };

  const handleChange = (e: any) => {
    const htmlContent = e.target.value;
    onChange(htmlContent);
  };

  return (
    <div className={className}>
      <Editor 
        value={convertPlainTextToHtml(value)}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        containerProps={{
          style: { 
            minHeight: '200px',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            resize: 'vertical',
            overflow: 'auto'
          }
        }}
      >
        <Toolbar>
          <BtnStyles />
          <Separator />
          <BtnBold />
          <BtnItalic />
          <Separator />
          <BtnBulletList />
          <BtnNumberedList />
          <Separator />
          <BtnClearFormatting />
          <Separator />
          <BtnUndo />
          <BtnRedo />
        </Toolbar>
      </Editor>
    </div>
  );
} 