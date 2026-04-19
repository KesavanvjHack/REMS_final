import { useEffect } from 'react';

const EnvCheck = () => {
    useEffect(() => {
        console.log("Is Electron:", !!(window && window.process && window.process.versions && window.process.versions.electron));
        console.log("Process Info:", window.process);
    }, []);
    return null;
}

export default EnvCheck;
