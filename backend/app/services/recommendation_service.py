"""
recommendation_service.py

Personalized Learning Recommendation Engine for CodeLens AI.
Uses user learning history from MongoDB (activities, executions, programs, debug_sessions)
to intelligently analyze:
  1. Skill level & proficiency score
  2. Weak programming concepts (derived from actual runtime/syntax errors and failed executions)
  3. Topics to study next (guided DSA curriculum roadmap)
  4. Practice questions tailored to their skill level
  5. Coding challenges with Big-O complexity constraints
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from ..database.mongodb import get_mongodb
from ..schemas.dashboard import (
    PersonalizedRecommendationsResponse,
    WeakConceptItem,
    TopicToStudyItem,
    PracticeQuestionItem,
    CodingChallengeItem,
)

logger = logging.getLogger(__name__)

def _user_query(user_id: Any) -> dict:
    try:
        u_int = int(user_id)
        return {"$or": [{"user_id": u_int}, {"user_id": str(user_id)}]}
    except (ValueError, TypeError):
        return {"user_id": user_id}

# Standard DSA Curriculum Roadmap
CURRICULUM_ROADMAP = [
    {
        "id": "arrays-pointers",
        "topic": "Arrays & Two Pointers",
        "difficulty": "Beginner",
        "reason": "Master contiguous memory traversal and in-place element manipulation.",
        "prerequisites": "Basic loops and variables",
        "estimated_hours": 3.5,
        "icon": "📦",
    },
    {
        "id": "hash-maps",
        "topic": "Hash Maps & Frequency Tables",
        "difficulty": "Beginner",
        "reason": "Trade O(n) space to achieve O(1) constant-time lookups and deduplication.",
        "prerequisites": "Arrays & Key-Value concepts",
        "estimated_hours": 4.0,
        "icon": "⚡",
    },
    {
        "id": "sliding-window",
        "topic": "Sliding Window Technique",
        "difficulty": "Intermediate",
        "reason": "Optimize nested subarray iterations from O(n²) to optimal O(n) linear time.",
        "prerequisites": "Two Pointers & Arrays",
        "estimated_hours": 4.5,
        "icon": "🪟",
    },
    {
        "id": "binary-search",
        "topic": "Binary Search & Search Space Reduction",
        "difficulty": "Intermediate",
        "reason": "Attain logarithmic O(log n) time complexity on sorted data and monotonic functions.",
        "prerequisites": "Arrays & Midpoint logic",
        "estimated_hours": 5.0,
        "icon": "🔍",
    },
    {
        "id": "linked-lists",
        "topic": "Linked Lists & Fast/Slow Pointers",
        "difficulty": "Intermediate",
        "reason": "Understand dynamic pointer allocation, cycle detection, and memory nodes.",
        "prerequisites": "Pointers & References",
        "estimated_hours": 5.5,
        "icon": "🔗",
    },
    {
        "id": "stacks-queues",
        "topic": "Stacks, Queues & Monotonic Deques",
        "difficulty": "Intermediate",
        "reason": "Manage LIFO/FIFO operations, parentheses validation, and next-greater-element queries.",
        "prerequisites": "Arrays & Lists",
        "estimated_hours": 4.5,
        "icon": "📚",
    },
    {
        "id": "trees-traversal",
        "topic": "Binary Trees & Tree Traversals (BFS/DFS)",
        "difficulty": "Intermediate",
        "reason": "Master hierarchical data models, recursion invariants, and level-order traversals.",
        "prerequisites": "Recursion & Queues",
        "estimated_hours": 6.5,
        "icon": "🌲",
    },
    {
        "id": "graphs",
        "topic": "Graphs, Adjacency Lists & Cycle Detection",
        "difficulty": "Advanced",
        "reason": "Traverse interconnected networks, topological sort, and shortest path algorithms.",
        "prerequisites": "Trees, BFS & DFS",
        "estimated_hours": 8.0,
        "icon": "🕸️",
    },
    {
        "id": "dynamic-programming",
        "topic": "Dynamic Programming (Memoization & Tabulation)",
        "difficulty": "Advanced",
        "reason": "Solve overlapping subproblems and optimal substructure problems with linear space.",
        "prerequisites": "Recursion & State caching",
        "estimated_hours": 10.0,
        "icon": "🧩",
    },
]

# Question Pool categorized by skill level
PRACTICE_QUESTION_POOL: Dict[str, List[Dict[str, Any]]] = {
    "Beginner": [
        {
            "id": "q-two-sum",
            "title": "Two Sum (Target Pair Search)",
            "topic": "Arrays & Hash Maps",
            "difficulty": "Easy",
            "time_estimate_mins": 15,
            "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. Target O(n) time complexity.",
            "language": "python",
            "starter_code": "def two_sum(nums, target):\n    # Find two indices that sum to target in O(n) time\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []\n\n# Test\nprint(two_sum([2, 7, 11, 15], 9))\n",
        },
        {
            "id": "q-move-zeroes",
            "title": "Move Zeroes In-Place",
            "topic": "Two Pointers",
            "difficulty": "Easy",
            "time_estimate_mins": 15,
            "description": "Given an integer array `nums`, move all 0's to the end of it while maintaining the relative order of the non-zero elements. You must do this in-place in O(n) time and O(1) space.",
            "language": "java",
            "starter_code": "public class Solution {\n    public static void moveZeroes(int[] nums) {\n        int insertPos = 0;\n        for (int num : nums) {\n            if (num != 0) {\n                nums[insertPos++] = num;\n            }\n        }\n        while (insertPos < nums.length) {\n            nums[insertPos++] = 0;\n        }\n    }\n    public static void main(String[] args) {\n        int[] arr = {0, 1, 0, 3, 12};\n        moveZeroes(arr);\n        for (int x : arr) System.out.print(x + \" \");\n    }\n}\n",
        },
        {
            "id": "q-valid-parentheses",
            "title": "Valid Parentheses & Bracket Matching",
            "topic": "Stacks",
            "difficulty": "Easy",
            "time_estimate_mins": 20,
            "description": "Given a string containing `()`, `{}`, and `[]`, determine if the input string is valid using a LIFO Stack in O(n) time.",
            "language": "python",
            "starter_code": "def is_valid(s: str) -> bool:\n    stack = []\n    mapping = {')': '(', '}': '{', ']': '['}\n    for char in s:\n        if char in mapping:\n            top = stack.pop() if stack else '#'\n            if mapping[char] != top:\n                return False\n        else:\n            stack.append(char)\n    return not stack\n\nprint(is_valid(\"()[]{}\"))\nprint(is_valid(\"(]\"))\n",
        },
    ],
    "Intermediate": [
        {
            "id": "q-binary-search",
            "title": "Binary Search on Rotated Sorted Array",
            "topic": "Binary Search",
            "difficulty": "Medium",
            "time_estimate_mins": 25,
            "description": "Given a rotated sorted array, search for target in O(log n) time. Determine which half is sorted on each halving step.",
            "language": "cpp",
            "starter_code": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint searchRotated(vector<int>& nums, int target) {\n    int left = 0, right = nums.size() - 1;\n    while (left <= right) {\n        int mid = left + (right - left) / 2;\n        if (nums[mid] == target) return mid;\n        if (nums[left] <= nums[mid]) {\n            if (target >= nums[left] && target < nums[mid]) right = mid - 1;\n            else left = mid + 1;\n        } else {\n            if (target > nums[mid] && target <= nums[right]) left = mid + 1;\n            else right = mid - 1;\n        }\n    }\n    return -1;\n}\n\nint main() {\n    vector<int> nums = {4, 5, 6, 7, 0, 1, 2};\n    cout << \"Target index: \" << searchRotated(nums, 0) << endl;\n    return 0;\n}\n",
        },
        {
            "id": "q-longest-substring",
            "title": "Longest Substring Without Repeating Characters",
            "topic": "Sliding Window",
            "difficulty": "Medium",
            "time_estimate_mins": 25,
            "description": "Find the length of the longest substring without repeating characters using a sliding window and hash map in O(n) time.",
            "language": "python",
            "starter_code": "def length_of_longest_substring(s: str) -> int:\n    char_index = {}\n    max_len = 0\n    start = 0\n    for end, char in enumerate(s):\n        if char in char_index and char_index[char] >= start:\n            start = char_index[char] + 1\n        char_index[char] = end\n        max_len = max(max_len, end - start + 1)\n    return max_len\n\nprint(length_of_longest_substring(\"abcabcbb\"))\n",
        },
        {
            "id": "q-invert-tree",
            "title": "Invert / Mirror Binary Tree",
            "topic": "Binary Trees",
            "difficulty": "Medium",
            "time_estimate_mins": 20,
            "description": "Given the root of a binary tree, invert the tree and return its root using recursive or iterative DFS in O(n) time.",
            "language": "java",
            "starter_code": "public class InvertTree {\n    static class TreeNode {\n        int val;\n        TreeNode left, right;\n        TreeNode(int v) { val = v; }\n    }\n    public static TreeNode invertTree(TreeNode root) {\n        if (root == null) return null;\n        TreeNode temp = root.left;\n        root.left = invertTree(root.right);\n        root.right = invertTree(temp);\n        return root;\n    }\n    public static void main(String[] args) {\n        TreeNode root = new TreeNode(4);\n        root.left = new TreeNode(2);\n        root.right = new TreeNode(7);\n        invertTree(root);\n        System.out.println(\"Root inverted successfully: \" + root.val);\n    }\n}\n",
        },
    ],
    "Advanced": [
        {
            "id": "q-lru-cache",
            "title": "LRU Cache (O(1) Get & Put)",
            "topic": "Hash Map & Doubly Linked List",
            "difficulty": "Hard",
            "time_estimate_mins": 35,
            "description": "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) time complexity for both get and put operations.",
            "language": "python",
            "starter_code": "class Node:\n    def __init__(self, key=0, val=0):\n        self.key, self.val = key, val\n        self.prev = self.next = None\n\nclass LRUCache:\n    def __init__(self, capacity: int):\n        self.cap = capacity\n        self.cache = {}\n        self.head, self.tail = Node(), Node()\n        self.head.next = self.tail\n        self.tail.prev = self.head\n\n    def get(self, key: int) -> int:\n        if key in self.cache:\n            node = self.cache[key]\n            self._remove(node)\n            self._add(node)\n            return node.val\n        return -1\n\n    def put(self, key: int, value: int) -> None:\n        if key in self.cache:\n            self._remove(self.cache[key])\n        node = Node(key, value)\n        self.cache[key] = node\n        self._add(node)\n        if len(self.cache) > self.cap:\n            lru = self.head.next\n            self._remove(lru)\n            del self.cache[lru.key]\n\n    def _remove(self, node):\n        node.prev.next = node.next\n        node.next.prev = node.prev\n\n    def _add(self, node):\n        prev = self.tail.prev\n        prev.next = node\n        node.prev = prev\n        node.next = self.tail\n        self.tail.prev = node\n",
        },
        {
            "id": "q-trapping-rain-water",
            "title": "Trapping Rain Water (Two Pointers)",
            "topic": "Two Pointers & Monotonic Stack",
            "difficulty": "Hard",
            "time_estimate_mins": 30,
            "description": "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining in O(n) time and O(1) space.",
            "language": "cpp",
            "starter_code": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint trap(vector<int>& height) {\n    int l = 0, r = height.size() - 1;\n    int leftMax = 0, rightMax = 0, res = 0;\n    while (l < r) {\n        if (height[l] < height[r]) {\n            if (height[l] >= leftMax) leftMax = height[l];\n            else res += leftMax - height[l];\n            l++;\n        } else {\n            if (height[r] >= rightMax) rightMax = height[r];\n            else res += rightMax - height[r];\n            r--;\n        }\n    }\n    return res;\n}\n\nint main() {\n    vector<int> h = {0,1,0,2,1,0,1,3,2,1,2,1};\n    cout << \"Trapped water: \" << trap(h) << \" units\" << endl;\n    return 0;\n}\n",
        },
    ],
}

# Skill-Adapted Coding Challenges
CODING_CHALLENGES_POOL: Dict[str, List[Dict[str, Any]]] = {
    "Beginner": [
        {
            "id": "ch-best-time-stock",
            "title": "Stock Profit Maximizer",
            "skill_level": "Beginner",
            "xp_points": 100,
            "target_time_complexity": "O(n)",
            "target_space_complexity": "O(1)",
            "description": "Maximize profit from stock price array with a single transaction in O(n) linear time.",
            "language": "python",
            "starter_code": "def max_profit(prices):\n    min_price = float('inf')\n    max_p = 0\n    for p in prices:\n        if p < min_price:\n            min_price = p\n        elif p - min_price > max_p:\n            max_p = p - min_price\n    return max_p\n\nprint(max_profit([7, 1, 5, 3, 6, 4]))\n",
        },
        {
            "id": "ch-palindrome-number",
            "title": "Palindrome Integer Without String Conversion",
            "skill_level": "Beginner",
            "xp_points": 120,
            "target_time_complexity": "O(log n)",
            "target_space_complexity": "O(1)",
            "description": "Determine whether an integer is a palindrome by reversing only the half of the integer.",
            "language": "java",
            "starter_code": "public class PalindromeCheck {\n    public static boolean isPalindrome(int x) {\n        if (x < 0 || (x % 10 == 0 && x != 0)) return false;\n        int rev = 0;\n        while (x > rev) {\n            rev = rev * 10 + x % 10;\n            x /= 10;\n        }\n        return x == rev || x == rev / 10;\n    }\n    public static void main(String[] args) {\n        System.out.println(isPalindrome(121));\n        System.out.println(isPalindrome(-121));\n    }\n}\n",
        },
    ],
    "Intermediate": [
        {
            "id": "ch-merge-intervals",
            "title": "Merge Overlapping Intervals",
            "skill_level": "Intermediate",
            "xp_points": 180,
            "target_time_complexity": "O(n log n)",
            "target_space_complexity": "O(n)",
            "description": "Given an array of intervals, merge all overlapping intervals into non-overlapping spans.",
            "language": "python",
            "starter_code": "def merge_intervals(intervals):\n    intervals.sort(key=lambda x: x[0])\n    merged = []\n    for interval in intervals:\n        if not merged or merged[-1][1] < interval[0]:\n            merged.append(interval)\n        else:\n            merged[-1][1] = max(merged[-1][1], interval[1])\n    return merged\n\nprint(merge_intervals([[1,3],[2,6],[8,10],[15,18]]))\n",
        },
        {
            "id": "ch-3sum",
            "title": "3Sum (Zero-Sum Triplet Search)",
            "skill_level": "Intermediate",
            "xp_points": 220,
            "target_time_complexity": "O(n²)",
            "target_space_complexity": "O(1)",
            "description": "Find all unique triplets in the array which gives the sum of zero. Avoid duplicate triplets.",
            "language": "cpp",
            "starter_code": "#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nvector<vector<int>> threeSum(vector<int>& nums) {\n    vector<vector<int>> res;\n    sort(nums.begin(), nums.end());\n    for (int i = 0; i < (int)nums.size() - 2; i++) {\n        if (i > 0 && nums[i] == nums[i-1]) continue;\n        int l = i + 1, r = nums.size() - 1;\n        while (l < r) {\n            int s = nums[i] + nums[l] + nums[r];\n            if (s == 0) {\n                res.push_back({nums[i], nums[l], nums[r]});\n                while (l < r && nums[l] == nums[l+1]) l++;\n                while (l < r && nums[r] == nums[r-1]) r--;\n                l++; r--;\n            } else if (s < 0) l++;\n            else r--;\n        }\n    }\n    return res;\n}\n",
        },
    ],
    "Advanced": [
        {
            "id": "ch-coin-change",
            "title": "Coin Change (Fewest Coins DP)",
            "skill_level": "Advanced",
            "xp_points": 300,
            "target_time_complexity": "O(amount * n)",
            "target_space_complexity": "O(amount)",
            "description": "Compute fewest number of coins needed to make up a given amount using bottom-up dynamic programming.",
            "language": "python",
            "starter_code": "def coin_change(coins, amount):\n    dp = [float('inf')] * (amount + 1)\n    dp[0] = 0\n    for c in coins:\n        for a in range(c, amount + 1):\n            dp[a] = min(dp[a], dp[a - c] + 1)\n    return dp[amount] if dp[amount] != float('inf') else -1\n\nprint(coin_change([1, 2, 5], 11))\n",
        },
    ],
}


def generate_personalized_recommendations(user_id: Any) -> PersonalizedRecommendationsResponse:
    """
    Main recommendation engine function.
    Queries user records in MongoDB and calculates tailored learning recommendations.
    """
    mongo_db = get_mongodb()
    user_q = _user_query(user_id)

    # 1. Fetch user data from MongoDB collections
    activities_count = 0
    executions_count = 0
    programs_count = 0
    debug_sessions_count = 0

    topics_practiced = set()
    languages_practiced = set()
    error_patterns = []

    if mongo_db is not None:
        try:
            activities_cursor = mongo_db.activities.find(user_q)
            for a in activities_cursor:
                activities_count += 1
                if a.get("topic"):
                    topics_practiced.add(str(a["topic"]).strip())
                if a.get("language"):
                    languages_practiced.add(str(a["language"]).strip().lower())
                if a.get("status") in ("error", "failed"):
                    desc = str(a.get("description") or "")
                    if desc:
                        error_patterns.append(desc)

            executions_cursor = mongo_db.executions.find(user_q)
            for e in executions_cursor:
                executions_count += 1
                if e.get("stderr"):
                    error_patterns.append(str(e["stderr"]))
                if e.get("language"):
                    languages_practiced.add(str(e["language"]).strip().lower())

            programs_cursor = mongo_db.programs.find(user_q)
            for p in programs_cursor:
                programs_count += 1
                if p.get("language"):
                    languages_practiced.add(str(p["language"]).strip().lower())

            debug_cursor = mongo_db.debug_sessions.find(user_q)
            for d in debug_cursor:
                debug_sessions_count += 1
                if d.get("error_type"):
                    error_patterns.append(str(d["error_type"]))
                if d.get("error_message"):
                    error_patterns.append(str(d["error_message"]))
        except Exception as ex:
            logger.warning("Error fetching user history from MongoDB for recommendations: %s", ex)

    # 2. Determine Skill Level & Score
    total_actions = activities_count + executions_count + programs_count
    
    if total_actions <= 4:
        skill_level = "Beginner"
        skill_score = min(48, max(25, 25 + total_actions * 5))
        summary = (
            f"You are building your core programming foundation ({total_actions} recorded actions). "
            "Focus on clean loop boundaries, pointer manipulations, and basic collection operations."
        )
    elif total_actions <= 14:
        skill_level = "Intermediate"
        skill_score = min(75, max(52, 50 + int((total_actions - 4) * 2.3)))
        summary = (
            f"You are progressing well through intermediate algorithms ({total_actions} recorded actions). "
            "Level up your asymptotic time optimization with Hash Maps, Sliding Windows, and Binary Search."
        )
    else:
        skill_level = "Advanced"
        skill_score = min(96, max(78, 76 + int((total_actions - 14) * 0.8)))
        summary = (
            f"Advanced mastery demonstrated ({total_actions} actions across {len(languages_practiced) or 1} languages). "
            "Tackle Tree traversals, Graph pathfinding, and Dynamic Programming transitions."
        )

    # 3. Detect Weak Programming Concepts based on Error History
    err_blob = " ".join(error_patterns).lower()
    weak_concepts: List[WeakConceptItem] = []

    # Check 1: Array boundary / index errors
    has_index_err = any(k in err_blob for k in ["indexout", "out of range", "indexerror", "arrayindex", "bounds"])
    if has_index_err or len(weak_concepts) == 0:
        weak_concepts.append(
            WeakConceptItem(
                id="weak-array-bounds",
                concept="Array Boundary & Index Off-By-One Logic",
                category="Arrays & Linear Memory",
                severity="High" if has_index_err else "Medium",
                detected_mistakes_count=max(1, err_blob.count("index") or 2),
                diagnostic="Encountered index exceeding collection size during iteration.",
                remedial_tip="Ensure loop termination strictly uses `i < arr.length` (or `len(arr)`) rather than `<=` to prevent overflow.",
                practice_topic="Arrays & Two Pointers",
            )
        )

    # Check 2: Null pointer / reference / undefined
    has_null_err = any(k in err_blob for k in ["nullpointer", "nonetype", "undefined", "attributeerror", "segmentation"])
    if has_null_err or len(weak_concepts) < 2:
        weak_concepts.append(
            WeakConceptItem(
                id="weak-null-reference",
                concept="Null Pointers & Uninitialized References",
                category="Memory & Object Safety",
                severity="High" if has_null_err else "Medium",
                detected_mistakes_count=max(1, err_blob.count("null") or 1),
                diagnostic="Invoking methods or attributes on unassigned or null references.",
                remedial_tip="Add pre-condition guard clauses (e.g., `if (node == null) return;`) before accessing object members.",
                practice_topic="Linked Lists & Pointers",
            )
        )

    # Check 3: Recursion stack overflow or base case missing
    has_recursion_err = any(k in err_blob for k in ["recursionerror", "stackoverflow", "maximum recursion"])
    if has_recursion_err or len(weak_concepts) < 3:
        weak_concepts.append(
            WeakConceptItem(
                id="weak-recursion",
                concept="Recursive Termination & Call Stack Overflows",
                category="Recursion & Divide and Conquer",
                severity="High" if has_recursion_err else "Low",
                detected_mistakes_count=max(1, err_blob.count("recursion") or 1),
                diagnostic="Recursive calls triggering infinite depth without meeting base condition.",
                remedial_tip="Verify base cases are checked at the very top of recursive functions before branching.",
                practice_topic="Binary Trees & Recursion",
            )
        )

    # Check 4: Time complexity / timeout
    has_timeout_err = any(k in err_blob for k in ["time limit", "timeout", "timed out", "infinite loop"])
    if has_timeout_err:
        weak_concepts.append(
            WeakConceptItem(
                id="weak-complexity",
                concept="Inefficient Nested Loops & O(n²) Time Complexity",
                category="Complexity Optimization",
                severity="High",
                detected_mistakes_count=max(1, err_blob.count("timeout") or 1),
                diagnostic="Algorithm exceeding allowed execution cycles due to quadratic nested iterations.",
                remedial_tip="Replace inner search loops with a Hash Table or Hash Set to bring time down to O(n).",
                practice_topic="Hash Maps & Frequency Tables",
            )
        )

    # 4. Select Topics to Study Next
    # Prioritize topics not yet heavily practiced
    topics_to_study: List[TopicToStudyItem] = []
    for item in CURRICULUM_ROADMAP:
        is_already_practiced = any(t.lower() in item["topic"].lower() for t in topics_practiced)
        # Match skill level appropriate topics
        if skill_level == "Beginner" and item["difficulty"] in ("Beginner", "Intermediate"):
            if not is_already_practiced or len(topics_to_study) < 2:
                topics_to_study.append(TopicToStudyItem(**item))
        elif skill_level == "Intermediate" and item["difficulty"] in ("Intermediate", "Advanced"):
            if not is_already_practiced or len(topics_to_study) < 2:
                topics_to_study.append(TopicToStudyItem(**item))
        elif skill_level == "Advanced" and item["difficulty"] == "Advanced":
            topics_to_study.append(TopicToStudyItem(**item))

        if len(topics_to_study) >= 4:
            break

    # Fallback if list is too small
    if len(topics_to_study) < 3:
        for item in CURRICULUM_ROADMAP:
            if not any(t.id == item["id"] for t in topics_to_study):
                topics_to_study.append(TopicToStudyItem(**item))
            if len(topics_to_study) >= 3:
                break

    # 5. Select Practice Questions
    questions_raw = PRACTICE_QUESTION_POOL.get(skill_level, PRACTICE_QUESTION_POOL["Beginner"])
    practice_questions = [PracticeQuestionItem(**q) for q in questions_raw[:3]]

    # 6. Select Coding Challenges
    challenges_raw = CODING_CHALLENGES_POOL.get(skill_level, CODING_CHALLENGES_POOL["Beginner"])
    coding_challenges = [CodingChallengeItem(**c) for c in challenges_raw[:2]]

    response = PersonalizedRecommendationsResponse(
        skill_level=skill_level,
        skill_score=skill_score,
        summary=summary,
        weak_concepts=weak_concepts,
        topics_to_study=topics_to_study,
        practice_questions=practice_questions,
        coding_challenges=coding_challenges,
    )

    # 7. Persist snapshot into MongoDB `user_recommendations` collection for tracking
    if mongo_db is not None:
        try:
            snapshot_doc = {
                "user_id": user_id,
                "skill_level": skill_level,
                "skill_score": skill_score,
                "weak_concepts_count": len(weak_concepts),
                "topics_recommended": [t.topic for t in topics_to_study],
                "updated_at": datetime.now(timezone.utc),
            }
            mongo_db.user_recommendations.update_one(
                _user_query(user_id),
                {"$set": snapshot_doc},
                upsert=True
            )
        except Exception as save_err:
            logger.warning("Could not persist recommendation snapshot in MongoDB: %s", save_err)

    return response
