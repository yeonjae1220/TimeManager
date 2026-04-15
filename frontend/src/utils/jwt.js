export function decodeJwtPayload(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
}

export function extractRoleFromToken(token) {
    const payload = decodeJwtPayload(token);
    return payload?.role ?? 'MEMBER';
}
