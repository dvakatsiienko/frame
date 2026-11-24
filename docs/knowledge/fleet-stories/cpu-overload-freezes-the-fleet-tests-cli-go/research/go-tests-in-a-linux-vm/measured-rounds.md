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

round 4, FRM-551 size sweep: vm-go-test (ubuntu 26.04 minimal, vz, containerd none, no mounts), x/go warm in a real git worktree, no CI unless tagged, host load 20–33:
    columns: time, vcpus, ram GiB, -parallel, tag, VZ process cpu-s, hostagent cpu-s, guest /proc/stat cpu-s, wall s, exit, peak used KiB, fails, swap KiB, oom, ok lines
    21:27:45	4	8	5	warmup	128.19	.38	129.78	51.0454	0	1109324	0	0	0	1
    21:28:46	4	8	3	run	116.96	.36	111.28	60.9964	0	1006224	0	0	0	1
    21:29:54	4	8	3	run	120.18	.33	119.79	67.3603	0	1043196	0	0	0	1
    21:30:41	4	8	5	run	116.20	.33	116.54	46.8096	0	1124656	0	0	0	1
    21:31:44	4	8	5	run	120.62	.30	129.42	62.5328	0	1140792	0	0	0	1
    21:32:22	4	8	7	run	112.67	.30	110.72	37.7174	0	1279928	0	0	0	1
    21:32:59	4	8	7	run	111.83	.30	109.47	37.1366	0	1234788	0	0	0	1
    21:33:55	6	8	5	warmup	129.10	.36	137.77	50.4105	0	1179996	0	0	0	1
    21:34:58	6	8	3	run	125.48	.36	123.17	63.1902	0	1023448	0	0	0	1
    21:35:59	6	8	3	run	122.86	.34	118.41	60.5246	0	1029620	0	0	0	1
    21:36:39	6	8	5	run	118.17	.32	113.75	39.4965	0	1140156	0	0	0	1
    21:37:26	6	8	5	run	126.01	.32	128.31	46.3997	0	1129512	0	0	0	1
    21:38:05	6	8	7	run	129.91	.35	135.14	38.9371	0	1169280	0	0	0	1
    21:38:49	6	8	7	run	139.05	.34	155.47	43.5165	0	1228544	0	0	0	1
    21:39:46	8	8	5	warmup	140.83	.36	150.68	51.8092	0	1134516	0	0	0	1
    21:40:51	8	8	3	run	136.68	.38	134.21	64.3133	0	1064176	0	0	0	1
    21:42:09	8	8	3	run	148.38	.38	153.96	77.3633	0	1026620	0	0	0	1
    21:43:01	8	8	5	run	143.37	.36	153.96	52.5024	0	1216596	0	0	0	1
    21:44:09	8	8	5	run	151.45	.38	176.33	66.7193	0	1170076	0	0	0	1
    21:44:52	8	8	7	run	142.18	.34	150.3	41.1886	0	1205188	0	0	0	1
    21:45:29	8	8	7	run	142.98	.33	148.21	36.5716	0	1265584	0	0	0	1
    21:46:14	10	8	5	warmup	140.56	.37	131.77	38.9817	0	1063420	0	0	0	1
    21:47:29	10	8	3	run	151.12	.40	149.65	74.5418	0	1075192	0	0	0	1
    21:48:36	10	8	3	run	147.11	.37	143.81	66.6062	0	1091964	0	0	0	1
    21:49:13	10	8	5	run	136.33	.35	125.19	37.6386	0	1199180	0	0	0	1
    21:49:59	10	8	5	run	145.62	.36	145.59	45.4129	0	1176024	0	0	0	1
    21:50:40	10	8	7	run	147.61	.33	160.09	40.3077	0	1238596	0	0	0	1
    21:51:08	10	8	7	run	133.12	.35	125.42	27.65	0	1269336	0	0	0	1
    21:56:38	4	4	7	warmup	141.87	.41	181.41	113.592	0	1019912	0	0	0	1
    21:57:47	4	4	7	run	124.17	.36	137.78	68.1416	0	950368	0	0	0	1
    21:58:53	4	4	7	run	128.38	.35	148.04	66.0434	0	911948	0	0	0	1
    21:59:36	4	6	7	warmup	112.37	.32	110.5	37.8821	0	1163636	0	0	0	1
    22:00:25	4	6	7	run	120.04	.33	129.76	47.8105	0	1070044	0	0	0	1
    22:01:01	4	6	7	run	110.55	.31	108.32	35.7245	0	1168692	0	0	0	1
    22:01:39	4	8	7	warmup	105.40	.30	103.73	33.7599	0	1182700	0	0	0	1
    22:02:15	4	8	7	ci	105.93	.29	103.9	34.9649	0	1132132	0	0	0	1
    the pick: 4 vcpus, -parallel 7, 6 GiB, deadline 150 s (3× the pick's warm p90, 48 s). more vcpus buy a few s of wall for 20–40 cpu-s more;
    4 GiB never swaps (the image has no swap device) but doubles the wall; a CI=1 row costs what a plain one does, so round 2's 74–85 was not the whole guest
