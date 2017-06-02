<?php

namespace CftfBundle\Service;

use CftfBundle\Entity\LsDoc;
use CftfBundle\Entity\LsItem;
use Doctrine\Common\Persistence\ManagerRegistry;
use Doctrine\Common\Persistence\ObjectManager;
use JMS\DiExtraBundle\Annotation as DI;
use Ramsey\Uuid\Uuid;

/**
 * Class FrameworkUpdater.
 *
 * @DI\Service("framework_updater.local")
 */
class FrameworkUpdater
{
    /**
     * @var ManagerRegistry
     */
    private $managerRegistry;

    /**
     * @param ManagerRegistry $managerRegistry
     *
     * @DI\InjectParams({
     *     "managerRegistry" = @DI\Inject("doctrine"),
     * })
     */
    public function __construct(ManagerRegistry $managerRegistry)
    {
        $this->managerRegistry = $managerRegistry;
    }

    /**
     * @return ObjectManager
     */
    protected function getEntityManager()
    {
        return $this->managerRegistry->getManagerForClass(LsDoc::class);
    }

    /**
     * Update framework from a CSV
     *
     * @param LsDoc  $lsDoc
     * @param string $fileContent
     * @param string $frameworkToAssociate
     */
    public function update($lsDoc, $fileContent, $frameworkToAssociate)
    {
        $em = $this->getEntityManager();
        $contentTransformed = $this->transformContent($fileContent);
        $cfItems = [];

        for ($i = 0, $iMax = count($contentTransformed); $i < $iMax; ++$i)
        {
            $cfItem = $em
                ->getRepository('CftfBundle:LsItem')
                    ->findOneByIdentifier($contentTransformed[$i]['Identifier']);

            $cfItem->setLsDoc($lsDoc);
            $cfItem->setFullStatement($contentTransformed[$i]['Full Statement']);
            $cfItem->setHumanCodingScheme($contentTransformed[$i]['Human Coding Scheme']);
            $cfItem->setAbbreviatedStatement($contentTransformed[$i]['Abbreviated Statement']);
            $cfItem->setConceptKeywords($contentTransformed[$i]['Concept Keywords']);
            $cfItem->setLanguage($contentTransformed[$i]['Language']);
            $cfItem->setLicenceUri($contentTransformed[$i]['License']);
            $cfItem->setNotes($contentTransformed[$i]['Notes']);
            $cfItems[] = $cfItem;
        }
        $em->flush();
    }

    /**
     * Update framework from a CSV in a new derivative framework
     *
     * @param LsDoc  $lsDoc
     * @param string $fileContent
     * @param string $frameworkToAssociate
     */
    public function derivative($lsDoc, $fileContent, $frameworkToAssociate)
    {
        $em = $this->getEntityManager();
        $contentTransformed = $this->transformContent($fileContent);
        $cfItems = [];

        $newCfDocDerivated = $em->getRepository('CftfBundle:LsDoc')->makeDerivative($lsDoc);
        foreach($lsDoc->getTopLsItems() as $oldTopItem){
            $newItem = $oldTopItem->duplicateToLsDoc($newCfDocDerivated);

            $newAssoc = $newCfDocDerivated->createAssociation();
            $newAssoc->setOrigin($newItem);
            $newAssoc->setType(LsAssociation::EXACT_MATCH_OF);
            $newAssoc->setDestination($oldTopItem);
            $newItem->addAssociation($newAssoc);
        }

        $em->flush();
    }

    /**
     * Transform string content in arrays per line.
     *
     * @param string $fileContent
     *
     * @return array
     */
    protected function transformContent($fileContent)
    {
        $csvContent = str_getcsv($fileContent, "\n");
        $headers = [];
        $content = [];

        foreach ($csvContent as $i => $row) {
            $tempContent = [];
            $row = str_getcsv($row, ',');

            if ($i === 0) {
                $headers = $row;
                continue;
            }

            foreach ($headers as $h => $col) {
                if ($h < count($row)) {
                    $tempContent[$col] = $row[$h];
                }
            }

            $content[] = $tempContent;
        }

        return $content;
    }

}
