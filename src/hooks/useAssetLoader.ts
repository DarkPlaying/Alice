import { useState, useEffect } from 'react';

export function useAssetLoader(imageUrls: string[], videoUrls: string[] = []) {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const totalAssets = imageUrls.length + videoUrls.length;
        
        if (totalAssets === 0) {
            setIsLoaded(true);
            return;
        }

        let loadedCount = 0;

        const handleLoad = () => {
            loadedCount++;
            if (loadedCount === totalAssets && isMounted) {
                setIsLoaded(true);
            }
        };

        const handleError = () => {
            // Even if it fails to load, we count it so we don't get stuck forever
            loadedCount++;
            if (loadedCount === totalAssets && isMounted) {
                setIsLoaded(true);
            }
        };

        imageUrls.forEach(url => {
            const img = new Image();
            img.src = url;
            img.onload = handleLoad;
            img.onerror = handleError;
        });

        videoUrls.forEach(url => {
            const video = document.createElement('video');
            video.src = url;
            video.onloadeddata = handleLoad;
            video.onerror = handleError;
            video.load();
        });

        return () => {
            isMounted = false;
        };
    }, [imageUrls, videoUrls]);

    return isLoaded;
}
