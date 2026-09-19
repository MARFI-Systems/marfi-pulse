export const config = {
  apps: {
    installed: {
      authentication: {
        enabled: true,
      },
      emails: {
        enabled: true,
      },
    },
  },
  auth: {
    password: {
      allowSignIn: false,
    },
    otp: {
      allowSignIn: true,
    },
    passkey: {
      allowSignIn: false,
    },
    oauth: {
      providers: {},
    },
  },
};
