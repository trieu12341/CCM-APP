export async function loadComponent(elementId, componentPath) {
    try {
        const response = await fetch(componentPath);
        if (response.ok) {
            const html = await response.text();
            const el = document.getElementById(elementId);
            if (el) {
                // If it's a replace-style component, we replace innerHTML
                // Sometimes we want to append, but innerHTML is safest for swapping content.
                el.innerHTML += html;
            } else {
                console.warn(`Cannot find element ${elementId} to load ${componentPath}`);
            }
        } else {
            console.error(`Failed to load component: ${componentPath}`);
        }
    } catch (err) {
        console.error(`Error loading component ${componentPath}:`, err);
    }
}
