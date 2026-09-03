/**
 * Practice Problem configuration for CodeLens AI Editor.
 * Prepares the architecture for Mode B (Practice Problem Mode)
 * with language-specific starter code (e.g. LeetCode-style Solution class).
 */

export interface CodingProblem {
  id: string;
  title: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Easy' | 'Medium' | 'Hard';
  description?: string;
  starterCode: Record<string, string>;
}

export const CODING_PROBLEMS: Record<string, CodingProblem> = {
  'two-sum': {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    starterCode: {
      python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        pass
`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {

    }
}
`,
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {

    }
};
`,
      c: `/**
 * Note: The returned array must be malloced, assume caller calls free().
 */
int* twoSum(int* nums, int numsSize, int target, int* returnSize) {

}
`,
    },
  },
  'binary-search': {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    description: 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums.',
    starterCode: {
      python: `class Solution:
    def search(self, nums: list[int], target: int) -> int:
        pass
`,
      java: `class Solution {
    public int search(int[] nums, int target) {

    }
}
`,
      cpp: `class Solution {
public:
    int search(vector<int>& nums, int target) {

    }
};
`,
      c: `int search(int* nums, int numsSize, int target) {

}
`,
    },
  },
  'reverse-array': {
    id: 'reverse-array',
    title: 'Reverse Array',
    difficulty: 'Beginner',
    description: 'Reverse the elements in an array or slice in-place.',
    starterCode: {
      python: `def reverse_array(arr: list) -> list:
    # Write your solution here
    pass
`,
      java: `public class Solution {
    public static void reverseArray(int[] arr) {
        // Write your solution here
    }
}
`,
      cpp: `void reverseArray(vector<int>& arr) {
    // Write your solution here
}
`,
      c: `void reverseArray(int* arr, int arrSize) {
    // Write your solution here
}
`,
    },
  },
  'fibonacci': {
    id: 'fibonacci',
    title: 'Fibonacci Number',
    difficulty: 'Easy',
    description: 'Calculate the N-th Fibonacci number where F(0)=0, F(1)=1, and F(n)=F(n-1)+F(n-2).',
    starterCode: {
      python: `class Solution:
    def fib(self, n: int) -> int:
        pass
`,
      java: `class Solution {
    public int fib(int n) {

    }
}
`,
      cpp: `class Solution {
public:
    int fib(int n) {

    }
};
`,
      c: `int fib(int n) {

}
`,
    },
  },
  'valid-parentheses': {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    description: 'Given a string s containing just the characters (, ), {, }, [, ], determine if the input string is valid.',
    starterCode: {
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        pass
`,
      java: `class Solution {
    public boolean isValid(String s) {

    }
}
`,
      cpp: `class Solution {
public:
    bool isValid(string s) {

    }
};
`,
      c: `bool isValid(char* s) {

}
`,
    },
  },
};

export function getProblemById(id: string): CodingProblem | undefined {
  if (!id) return undefined;
  return CODING_PROBLEMS[id.toLowerCase().trim()];
}

export function getProblemStarterCode(problemId: string, lang: string): string | undefined {
  const problem = getProblemById(problemId);
  if (!problem) return undefined;
  return problem.starterCode[lang.toLowerCase().trim()];
}
