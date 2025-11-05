
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="text-center p-6 border-b border-gray-700 shadow-lg bg-gray-900/50">
      <h1 className="text-5xl md:text-6xl text-amber-400 tracking-wider">
        The Kutting Room
      </h1>
      <p className="text-gray-300 text-lg mt-1">AI Receptionist</p>
    </header>
  );
};
