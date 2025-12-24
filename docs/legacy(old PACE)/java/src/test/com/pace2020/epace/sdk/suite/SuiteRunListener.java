package com.pace2020.epace.sdk.suite;

import org.junit.runner.Description;
import org.junit.runner.Result;
import org.junit.runner.notification.RunListener;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
public class SuiteRunListener extends RunListener
{
    public void testStarted( Description description )
    {
        System.out.println( "Starting - " + description.getMethodName() );
    }

    public void testFinished( Description description )
    {
        System.out.println( "Finished - " + description.getMethodName() );
    }

    public void testRunFinished( Result result )
    {

    }
}