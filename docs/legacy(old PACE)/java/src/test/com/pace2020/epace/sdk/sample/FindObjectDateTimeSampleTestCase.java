package com.pace2020.epace.sdk.sample;

import java.util.List;

import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:ankur.kapoor@pace2020.com">Ankur Kapoor</a>
 */
public class FindObjectDateTimeSampleTestCase extends TestCase
{
    public void testFindObjectDateTime() throws Exception
    {
        final FindObjectDateTimeConstraints findObjects = new FindObjectDateTimeConstraints();

        final List jobs = findObjects.run();

        assertTrue( jobs.size() >= 0 );
    }
}
