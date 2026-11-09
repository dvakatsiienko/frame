# linux vm rounds, raw rows (FRM-536, 2026-11-09)

round 1, spawn-bench:
    vm	spawn	w1	std workers=1 wall=0.5ms/spawn parent=0.06ms child=0.43ms total=0.50ms
    mac	spawn	w1	std workers=1 wall=6.0ms/spawn parent=0.69ms child=4.49ms total=5.18ms
    vm	spawn	w10	std workers=10 wall=0.1ms/spawn parent=0.08ms child=0.54ms total=0.62ms
    mac	spawn	w10	std workers=10 wall=0.7ms/spawn parent=0.94ms child=4.06ms total=5.00ms
    vm	spawn	w1	std workers=1 wall=0.5ms/spawn parent=0.06ms child=0.43ms total=0.49ms
    mac	spawn	w1	std workers=1 wall=6.1ms/spawn parent=0.71ms child=4.53ms total=5.24ms
    vm	spawn	w10	std workers=10 wall=0.1ms/spawn parent=0.08ms child=0.57ms total=0.66ms
    mac	spawn	w10	std workers=10 wall=0.7ms/spawn parent=0.95ms child=4.17ms total=5.12ms
    vm	suite	45.60 wall 36.28 user 19.87 sys
    mac	suite	sys 98.32
    load	15:18  up 1 day, 12:55, 10 users, load averages: 7.84 6.29 6.67

round 2, go suite, whole tree:
    vm	1	27.23 wall 46.87 user 27.30 sys ok=1 fails=0
    mac	1	real 88.86 user 92.05 sys 149.88  ok=0 fails=1
    load	1	15:28  up 1 day, 13:06, 10 users, load averages: 29.21 17.27 11.83
    vm	2	29.27 wall 51.66 user 32.99 sys ok=1 fails=0
    mac	2	real 81.50 user 89.94 sys 144.76  ok=0 fails=1
    load	2	15:30  up 1 day, 13:07, 10 users, load averages: 20.93 17.42 12.53

vitest, whole tree:
    vm	1	20.06 wall 100.45 user 32.62 sys 
    mac	1	real 36.68 user 74.84 sys 48.39        Tests  2102 passed (2102)
    load	1	15:36  up 1 day, 13:14, 10 users, load averages: 37.52 22.12 15.74
    vm	2	19.45 wall 91.21 user 41.64 sys 
    mac	2	real 30.59 user 79.43 sys 48.81        Tests  2102 passed (2102)
    load	2	15:37  up 1 day, 13:15, 10 users, load averages: 51.51 28.03 18.27
