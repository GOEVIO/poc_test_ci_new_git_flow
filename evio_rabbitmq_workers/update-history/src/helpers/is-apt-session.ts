export const checkIsAPTSession = (session) => {
    return session?.userIdInfo?.clientType === "APT";
};
