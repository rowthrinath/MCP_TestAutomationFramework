export interface User {
  username: string;
  password: string;
  description: string;
}

export const USERS: Record<string, User> = {
  STANDARD: {
    username: 'standard_user',
    password: 'secret_sauce',
    description: 'The site should work as expected for this user'
  },
  LOCKED_OUT: {
    username: 'locked_out_user',
    password: 'secret_sauce',
    description: 'User is locked out and should not be able to log in'
  },
  PROBLEM: {
    username: 'problem_user',
    password: 'secret_sauce',
    description: 'Images are not loading for this user'
  },
  PERFORMANCE_GLITCH: {
    username: 'performance_glitch_user',
    password: 'secret_sauce',
    description: 'This user has high loading times'
  }
};

export const TEST_DATA = {
  BASE_URL: 'https://qa-challenge.codesubmit.io',
  TIMEOUTS: {
    SHORT: 5000,
    MEDIUM: 10000,
    LONG: 30000
  }
};
