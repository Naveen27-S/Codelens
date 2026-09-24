/**
 * src/config/templatesConfig.ts
 *
 * Pre-loaded practice and playground templates for Python, Java, C, and C++.
 */

export interface PracticeTemplate {
  id: string;
  title: string;
  language: string;
  category: string;
  description: string;
  code: string;
}

export const PRACTICE_TEMPLATES: PracticeTemplate[] = [
  // ── Python Templates ──────────────────────────────────────────────────────
  {
    id: 'py-two-sum',
    title: 'Two Sum Algorithm',
    language: 'python',
    category: 'Algorithms',
    description: 'Find two numbers in array that add up to target using hash map.',
    code: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []

numbers = [2, 7, 11, 15]
target_val = 9
result = two_sum(numbers, target_val)
print("Indices:", result)
`,
  },
  {
    id: 'py-binary-search',
    title: 'Binary Search',
    language: 'python',
    category: 'Algorithms',
    description: 'O(log N) binary search on sorted array.',
    code: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

sorted_list = [10, 20, 30, 40, 50, 60, 70]
target = 40
idx = binary_search(sorted_list, target)
print(f"Target {target} at index: {idx}")
`,
  },
  {
    id: 'py-merge-sort',
    title: 'Merge Sort',
    language: 'python',
    category: 'Algorithms',
    description: 'Divide and conquer sorting algorithm.',
    code: `def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    
    res = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] < right[j]:
            res.append(left[i])
            i += 1
        else:
            res.append(right[j])
            j += 1
    res.extend(left[i:])
    res.extend(right[j:])
    return res

nums = [64, 34, 25, 12, 22, 11, 90]
sorted_nums = merge_sort(nums)
print("Sorted Array:", sorted_nums)
`,
  },
  {
    id: 'py-recursion',
    title: 'Fibonacci Recursion',
    language: 'python',
    category: 'Recursion',
    description: 'Recursive call stack visualization of Fibonacci numbers.',
    code: `def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    return fibonacci(n - 1) + fibonacci(n - 2)

n_val = 6
ans = fibonacci(n_val)
print(f"Fibonacci({n_val}) = {ans}")
`,
  },

  // ── C++ Templates ────────────────────────────────────────────────────────
  {
    id: 'cpp-pointers',
    title: 'Pointers & Memory',
    language: 'cpp',
    category: 'C++ Basics',
    description: 'Pointer arithmetic and memory address inspection.',
    code: `#include <iostream>
using namespace std;

int main() {
    int val = 42;
    int* ptr = &val;
    
    cout << "Value = " << val << endl;
    cout << "Value via Pointer = " << *ptr << endl;
    
    *ptr = 100;
    cout << "Updated Value = " << val << endl;
    return 0;
}
`,
  },
  {
    id: 'cpp-vector-ops',
    title: 'Vector Operations',
    language: 'cpp',
    category: 'STL',
    description: 'Standard Template Library vector push/pop operations.',
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> numbers;
    numbers.push_back(5);
    numbers.push_back(10);
    numbers.push_back(15);
    
    cout << "Vector Size: " << numbers.size() << endl;
    for(int i = 0; i < numbers.size(); i++) {
        cout << "Elem [" << i << "] = " << numbers[i] << endl;
    }
    return 0;
}
`,
  },

  // ── C Templates ──────────────────────────────────────────────────────────
  {
    id: 'c-array-sum',
    title: 'Array Sum & Traversal',
    language: 'c',
    category: 'C Basics',
    description: 'Iterate through an array, calculate sum, and inspect memory values.',
    code: `#include <stdio.h>

int main() {
    int numbers[5] = {10, 20, 30, 40, 50};
    int total = 0;
    
    printf("Calculating array sum...\\n");
    for (int i = 0; i < 5; i++) {
        total = total + numbers[i];
        printf("Index %d: element = %d, running total = %d\\n", i, numbers[i], total);
    }
    
    printf("Final Sum = %d\\n", total);
    return 0;
}
`,
  },

  // ── Java Templates ───────────────────────────────────────────────────────
  {
    id: 'java-find-max',
    title: 'Find Maximum Element',
    language: 'java',
    category: 'Algorithms',
    description: 'Find the maximum value in an integer array using a loop.',
    code: `public class Main {
    public static void main(String[] args) {
        int[] scores = {45, 82, 93, 67, 99, 74};
        int max = scores[0];
        
        System.out.println("Searching for maximum score...");
        for (int i = 1; i < scores.length; i++) {
            if (scores[i] > max) {
                max = scores[i];
            }
            System.out.println("Inspecting score at index " + i + ": " + scores[i]);
        }
        
        System.out.println("Maximum Score: " + max);
    }
}
`,
  },
];

