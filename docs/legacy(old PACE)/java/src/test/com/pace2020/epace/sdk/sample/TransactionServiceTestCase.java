package com.pace2020.epace.sdk.sample;

import junit.framework.TestCase;

/**
 * @author <a href="mailto:nikhil.walvekar@efi.com">nikhil walvekar</a>
 */
public class TransactionServiceTestCase extends TestCase
{
    final TransactionServiceSample serviceSample = new TransactionServiceSample();

    public void testCase1() throws Exception
    {
        serviceSample.run();
    }

    public void testCase2() throws Exception
    {
        serviceSample.timeout();
    }

}