
import React from 'react';

interface VisualizerProps {
    micVolume: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ micVolume }) => {
    // Base scale relative to the button size
    const baseScale = 1.0; 
    // How much the rings expand when speaking
    const volumeBoost = micVolume * 2.0;

    const scale1 = baseScale + volumeBoost * 0.5;
    const scale2 = baseScale + volumeBoost * 1.0;
    const scale3 = baseScale + volumeBoost * 1.5;

    const baseOpacity = 0.1;
    const opacityBoost = micVolume * 0.4;

    const commonStyle: React.CSSProperties = {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        transition: 'transform 75ms ease-out, opacity 75ms ease-out',
        transformOrigin: 'center center',
    };

    return (
        <>
            {/* Outer ring */}
            <div
                style={{
                    ...commonStyle,
                    backgroundColor: `rgba(239, 68, 68, ${baseOpacity + opacityBoost * 0.5})`, // bg-red-500
                    transform: `scale(${scale3})`,
                }}
            />
            {/* Middle ring */}
            <div
                style={{
                    ...commonStyle,
                    backgroundColor: `rgba(239, 68, 68, ${baseOpacity + opacityBoost * 0.75})`,
                    transform: `scale(${scale2})`,
                }}
            />
            {/* Inner ring */}
            <div
                style={{
                    ...commonStyle,
                    backgroundColor: `rgba(239, 68, 68, ${baseOpacity + opacityBoost})`,
                    transform: `scale(${scale1})`,
                }}
            />
        </>
    );
};
