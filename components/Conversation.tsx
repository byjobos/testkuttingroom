
import React, { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../types';
import { Role } from '../types';

interface ConversationProps {
  transcript: TranscriptEntry[];
}

const TranscriptBubble: React.FC<{ entry: TranscriptEntry }> = ({ entry }) => {
    const isUser = entry.role === Role.User;
    const bubbleClasses = isUser
      ? 'bg-amber-500 text-black self-end rounded-br-none'
      : 'bg-gray-700 text-white self-start rounded-bl-none';
    const authorName = isUser ? 'You' : 'Receptionist';
  
    return (
      <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
        <p className="text-xs text-gray-400 mb-1 mx-3">{authorName}</p>
        <div
          className={`p-3 rounded-2xl max-w-sm md:max-w-md lg:max-w-lg shadow-md ${bubbleClasses}`}
        >
          <p>{entry.text || '...'}</p>
        </div>
      </div>
    );
  };

export const Conversation: React.FC<ConversationProps> = ({ transcript }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <div className="flex-grow overflow-y-auto p-4 space-y-4">
      {transcript.map((entry) => (
        <TranscriptBubble key={entry.id} entry={entry} />
      ))}
      <div ref={endOfMessagesRef} />
    </div>
  );
};
