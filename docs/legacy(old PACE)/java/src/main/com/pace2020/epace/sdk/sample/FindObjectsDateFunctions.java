/*
 * Copyright (c) 2005 Your Corporation. All Rights Reserved.
 */
package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class FindObjectsDateFunctions extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        List<?> jobs = null;
        jobs = new FindObjectsDateFunctions().runStartOfMonthSample();
        System.out.println( "StartOfMonthSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runEndOfMonthSample();
        System.out.println( "EndOfMonthSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runMonthSample();
        System.out.println( "MonthSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runStartOfWeekSample();
        System.out.println( "StartOfWeekSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runEndOfWeekSample();
        System.out.println( "EndOfWeekSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runStartOfYearSample();
        System.out.println( "StartOfYearSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runEndOfYearSample();
        System.out.println( "EndOfYearSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runYearSample();
        System.out.println( "YearSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runDaySample();
        System.out.println( "DaySample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runDateDiffSample();
        System.out.println( "DateDiffSample: Job count - " + jobs.size() );

        jobs = new FindObjectsDateFunctions().runDateAddSample();
        System.out.println( "DateAddSample: Job count - " + jobs.size() );
    }

    public List<?> runStartOfWeekSample() throws RemoteException
    {
        final String xpathExpr = "@dateSetup = date-add(start-of-week(current-date()),-31)";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runEndOfWeekSample() throws RemoteException
    {
        final String xpathExpr = "@dateSetup = date-add(end-of-week(current-date()),-31)";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runStartOfMonthSample() throws RemoteException
    {
        final String xpathExpr = "year(@dateSetup) = year(start-of-month(current-date()))";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runEndOfMonthSample() throws RemoteException
    {
        final String xpathExpr = "@dateSetup != end-of-month(current-date())";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runMonthSample() throws RemoteException
    {
        final String xpathExpr = "month(@dateSetup) = month(date-add(end-of-week(current-date()),-31))";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runStartOfYearSample() throws RemoteException
    {
        final String xpathExpr = "@dateSetup != start-of-year(current-date())";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runEndOfYearSample() throws RemoteException
    {
        final String xpathExpr = "@dateSetup != end-of-year(current-date())";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runYearSample() throws RemoteException
    {
        final String xpathExpr = "year(@dateSetup) = year(current-date())";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runDaySample() throws RemoteException
    {
        final String xpathExpr = "day(@dateSetup) = day(current-date())";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runDateDiffSample() throws RemoteException
    {
        final String xpathExpr =
            "@dateSetup = date-add(current-date(),date-diff(current-date(),start-of-month(current-date())))";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    public List<?> runDateAddSample() throws RemoteException
    {
        final String xpathExpr = "@dateSetup = date-add(start-of-month(current-date()),1)";
        return findObjectsUsingXpathFilter( xpathExpr );
    }

    protected List<?> findObjectsUsingXpathFilter( final String xpathExpr )
    {
        final List<String> keys2 = getFindObjectsPortType().find( "Job", xpathExpr ).getString();
        System.out.println( keys2.size() + " Jobs Setup" );

        return keys2;
    }

}
