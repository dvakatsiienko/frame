// Excalidraw puts an arrow label on the middle point, or the midpoint of the two middle points.
export const labelCenter = (points) => {
    const m = Math.floor(points.length / 2);
    if (points.length % 2) return points[m];
    return [
        (points[m - 1][0] + points[m][0]) / 2,
        (points[m - 1][1] + points[m][1]) / 2,
    ];
};
