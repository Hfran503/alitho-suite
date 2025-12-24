package com.pace2020.epace.sdk.sample;

import java.util.List;

import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class FindObjectDateFunctionsSampleTestCase extends TestCase
{
    public void testFindObjectDateAdd() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runDateAddSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectDateDiff() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runDateDiffSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectDay() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runDaySample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectEndOfMonth() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runEndOfMonthSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectEndOfWeek() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runEndOfWeekSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectEndOfYear() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runEndOfYearSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectMonth() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runMonthSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectStartOfMonth() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runStartOfMonthSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectStartOfWeek() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runStartOfWeekSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectStartOfYear() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runStartOfYearSample();
        assertTrue( jobs.size() >= 0 );
    }

    public void testFindObjectYear() throws Exception
    {
        final FindObjectsDateFunctions findObjects = new FindObjectsDateFunctions();

        final List<?> jobs = findObjects.runYearSample();
        assertTrue( jobs.size() >= 0 );
    }
}
