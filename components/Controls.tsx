
import React from 'react';
import { Visualizer } from './Visualizer';
import { Status } from '../types';
import { BOOKING_URL } from '../constants';

interface ControlsProps {
  status: Status;
  onToggle: () => void;
  micVolume: number;
}

const MicrophoneIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Zm0 12a5 5 0 0 1-5-5V5a5 5 0 0 1 10 0v6a5 5 0 0 1-5 5Z" />
        <path d="M19 11a1 1 0 0 0-2 0a6 6 0 0 1-12 0 1 1 0 0 0-2 0a8 8 0 0 0 7 7.93V21a1 1 0 0 0 2 0v-2.07A8 8 0 0 0 19 11Z" />
    </svg>
);

const ExternalLinkIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
);


export const Controls: React.FC<ControlsProps> = ({ status, onToggle, micVolume }) => {
    const isConnecting = status === Status.Connecting;
    const isListening = status === Status.Listening;
    const isProcessing = status === Status.Processing;
    const isIdle = status === Status.Idle;
    const hasError = status === Status.Error;

    let buttonClasses = 'bg-gray-600 hover:bg-gray-500';
    let statusText = 'Click the mic to start';

    if (isConnecting) {
        buttonClasses = 'bg-yellow-600 cursor-wait';
        statusText = 'Connecting...';
    } else if (isListening) {
        buttonClasses = 'bg-red-600 hover:bg-red-500';
        statusText = 'Listening... Click to stop';
    } else if (isProcessing) {
        buttonClasses = 'bg-blue-600 cursor-wait';
        statusText = 'Processing...';
    } else if (hasError) {
        buttonClasses = 'bg-red-800 hover:bg-red-700';
        statusText = 'An error occurred. Please try again.';
    }

    return (
        <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative h-20 w-20 flex items-center justify-center">
                {isListening && <Visualizer micVolume={micVolume} />}
                <button
                    onClick={onToggle}
                    disabled={isConnecting || isProcessing}
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg focus:outline-none focus:ring-4 focus:ring-amber-400/50 ${buttonClasses}`}
                    aria-label={isListening ? 'Stop conversation' : 'Start conversation'}
                >
                   <MicrophoneIcon className="w-10 h-10" />
                </button>
            </div>
            <p className="text-gray-400 text-sm h-5">{statusText}</p>
            <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 px-8 rounded-full transition-colors duration-300 shadow-lg text-lg tracking-wider"
                aria-label="Book an appointment now"
            >
                Book Now
                <ExternalLinkIcon className="w-5 h-5 ml-2" />
            </a>
        </div>
    );
};
