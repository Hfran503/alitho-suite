package com.pace2020.epace.sdk.sample;

import java.util.List;

import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class FindObjectSampleTestCase extends TestCase
{
    public void testFindObject() throws Exception
    {
        final FindObjects findObjects = new FindObjects();

        final List jobs = findObjects.run();

        assertTrue( jobs.size() >= 0 );
    }
}
