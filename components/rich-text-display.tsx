"use client"

import React from 'react';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

export function RichTextDisplay({ content, className = "" }: RichTextDisplayProps) {
  
  // Check if content is HTML or plain text
  const isHtml = content && (content.includes('<') && content.includes('>'));
  
  if (!content) {
    return null;
  }
  
  if (isHtml) {
    // Render HTML content
    return (
      <div 
        className={`rich-text-content ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  } else {
    // Render plain text with line breaks converted to <br>
    const formattedContent = content.replace(/\n/g, '<br>');
    return (
      <div 
        className={`rich-text-content ${className}`}
        dangerouslySetInnerHTML={{ __html: formattedContent }}
      />
    );
  }
} 